import { beginWork } from './beginWork';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestroy,
	commitHookEffectListUnmount,
	commitLayoutEffects,
	commitMutationEffects
} from './commitWork';
import { completeWork } from './completeWork';
import {
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects,
	createWorkInProgress
} from './fiber';
import { MutationMask, Noflags, PassiveMask } from './fiberFlags';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	lanesToSchedulerPriority,
	markRootFinished,
	mergeLanes
} from './fiberLanes';
import { HostRoot } from './workTags';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { scheduleMicroTask } from 'hostConfig';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_shouldYield,
	unstable_cancelCallback
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';
import { getSuspendedThenable, SuspenseException } from './thenable';

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects = false;

type RootExitStatus = number;
const RootInComplete = 1; // 中断执行
const RootCompleted = 2; // 执行完成
// TODO 执行过程报错

type SuspendedReason = typeof NotSuspended | typeof SuspendedOnData;
const NotSuspended = 0;
const SuspendedOnData = 1;
let wipSuspendedReason: SuspendedReason = NotSuspended;
let wipThrownValue: any = null;

// 初始化
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	root.finishedLane = NoLane;
	root.finishedWork = null;
	// workInProgress 变成重新创建的根节点
	workInProgress = createWorkInProgress(root.current, {});
	wipRootRenderLane = lane;
}

// 在Fiber中调度Update 每次触发更新都会调用
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// fiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	markRootUpdated(root, lane);
	//  调度功能
	ensureRootIsScheduled(root);
}

// schedule阶段入口
function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	const existingCallback = root.callbackNode;

	// 完成所有工作
	if (updateLane === NoLane) {
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback);
		}
		root.callbackNode = null;
		root.callbackPriority = NoLane;
		return;
	}

	const curPriority = updateLane;
	const prevPriority = root.callbackPriority;

	// 时间分片 和 高优先级打断区别就在这
	// 时间分片前后优先级相同，直接返回。高优先级打断，后者优先级更高，进入下方逻辑继续重新调度
	if (curPriority === prevPriority) {
		return;
	}

	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback);
	}

	let newCallbackNode = null;

	if (__DEV__) {
		console.log(
			`在${updateLane === SyncLane ? '微任务' : '宏任务'}中调度,优先级`,
			updateLane
		);
	}

	if (updateLane === SyncLane) {
		// 同步优先级  用微任务调度
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
		/* 用微任务去立即执行更新  */
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 其他优先级 用宏任务调度
		const schedulePriority = lanesToSchedulerPriority(updateLane);
		newCallbackNode = scheduleCallback(
			schedulePriority,
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}
	root.callbackNode = newCallbackNode;
	root.callbackPriority = curPriority;
}

// 将本次更新的lane记录在FiberRootNode上
function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// 从更新节点回溯到根节点fiberRootNode
function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}
	if (node.tag === HostRoot) {
		return node.stateNode;
	}
	return null;
}

function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	// 保证useEffect回调已经执行
	const curCallback = root.callbackNode;
	const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
	// 有副作用被执行完成
	if (didFlushPassiveEffect) {
		if (curCallback !== root.callbackNode) {
			// 当useEffect回调产生的任务优先级比当前任务高，那就打断，当前任务不应该继续调度
			return null;
		}
	}
	const lane = getHighestPriorityLane(root.pendingLanes);
	const curCallbackNode = root.callbackNode;
	if (lane === NoLane) {
		return null;
	}
	const needSync = lane === SyncLane || didTimeout;
	// render阶段
	const exitStatus = renderRoot(root, lane, !needSync);

	ensureRootIsScheduled(root);
	if (exitStatus === RootInComplete) {
		// 中断
		if (root.callbackNode !== curCallbackNode) {
			// 以及开启更高优先级的调度 返回null让原有的任务不要再进行调度
			return null;
		}
		return performConcurrentWorkOnRoot.bind(null, root);
	}
	if (exitStatus === RootCompleted) {
		// 更新结束
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = lane;
		wipRootRenderLane = NoLane;
		//  wip fiberNode树 树中的flags 执行DOM操作
		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现并发更新结束状态');
	}
}

// 同步更新入口: 拿到fiberRootNode，再从根节点向下更新
function performSyncWorkOnRoot(root: FiberRootNode) {
	const nextLane = getHighestPriorityLane(root.pendingLanes);

	if (nextLane !== SyncLane) {
		// 其他比SyncLane低的优先级
		// NoLane
		ensureRootIsScheduled(root);
		return;
	}

	const exitStatus = renderRoot(root, nextLane, false);
	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = nextLane;
		wipRootRenderLane = NoLane;
		//  wip fiberNode树 树中的flags 执行DOM操作
		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现同步更新结束状态');
	}
}

// render阶段
function renderRoot(
	root: FiberRootNode,
	lane: Lane,
	shouldTimeSlice: boolean
): RootExitStatus {
	if (__DEV__) {
		console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`);
	}

	// 初始化 workInProgress 指向要开始递归的根节点
	// 高优先级打断之后，render阶段又从根节点开始
	if (wipRootRenderLane !== lane) {
		prepareFreshStack(root, lane);
	}

	do {
		try {
			if (wipSuspendedReason !== NotSuspended && workInProgress !== null) {
				const thownvalue = wipThrownValue;
				wipSuspendedReason = NotSuspended;
				wipThrownValue = null;
				// unwind
			}
			// 进入工作循环
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop出现错误', e);
			}
			handleThrow(root, e);
		}
	} while (true);

	// 中断执行 || render阶段完成
	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete;
	}

	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error(' render阶段结束不应该不为null');
	}
	// TODO 报错
	return RootCompleted;
}

function throwAndUnwindWorkLoop(
	root: FiberRootNode,
	unitOfWork: FiberNode,
	throwValue: any,
	lane: Lane
) {
	// 重置FC全局变量
	// 请求返回后重新触发更新
	// unwind
}

function handleThrow(root: FiberRootNode, throwValue: any) {
	// Error Boundary
	if (throwValue === SuspenseException) {
		throwValue = getSuspendedThenable();
		wipSuspendedReason = SuspendedOnData;
	}
	wipThrownValue = throwValue;
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}
	const lane = root.finishedLane;

	if (lane === NoLane && __DEV__) {
		console.error('commit 阶段finishedLane不应该为NoLane');
	}

	// 重置
	root.finishedWork = null;
	root.finishedLane = NoLane;

	markRootFinished(root, lane);

	if (
		(finishedWork.flags & PassiveMask) !== Noflags ||
		(finishedWork.subtreeFlags & PassiveMask) !== Noflags
	) {
		// 存在函数组件需要执行useEffect的回调
		if (!rootDoesHasPassiveEffects) {
			// 防止多次调用
			rootDoesHasPassiveEffects = true;
			// 调度副作用
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	// 判断是否存在3个子阶段需要执行的操作
	// root 的 flags root 的 subtreeFlags 是否包含MutationMask中的Flags，如果有则存在mutation阶段需要执行的操作
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== Noflags;
	const rootHasEffect =
		(finishedWork.flags & (MutationMask | PassiveMask)) !== Noflags;

	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutation
		// mutation Placement
		commitMutationEffects(finishedWork, root);
		// 双缓存树切换
		root.current = finishedWork;

		// layout
		commitLayoutEffects(finishedWork, root);
	} else {
		root.current = finishedWork;
	}

	rootDoesHasPassiveEffects = false;
	ensureRootIsScheduled(root);
}
// 执行副作用
function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	let didFlushPassiveEffect = false;
	// 组件卸载的需要调用卸载回调函数
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListUnmount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];

	// 需要将上一次的卸载回调函数执行完再创建新的
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListDestroy(Passive | HookHasEffect, effect);
	});

	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffect = true;
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update = [];

	flushSyncCallbacks();
	return didFlushPassiveEffect;
}

function workLoopSync() {
	// 开始递归
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}
function workLoopConcurrent() {
	// 开始递归
	while (workInProgress !== null && !unstable_shouldYield()) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber, wipRootRenderLane);
	fiber.memoizedProps = fiber.pendingProps;

	// 如果没有子节点了，就到回溯阶段
	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		// 如果有子节点，就把 workInProgress 指向子节点 继续 workLoop 中的 while 循环，向下递归
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;

	do {
		completeWork(node);
		const sibling = node.sibling;
		// 如果有兄弟节点，继续递归兄弟节点
		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}
		// 如果没有兄弟节点，就回溯到父节点
		node = node.return;
		workInProgress = node;
	} while (node !== null);
}
