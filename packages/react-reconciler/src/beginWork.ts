import { ReactElementType } from 'shared/ReactTypes';
import {
	createFiberFromFragment,
	createFiberFromOffscreen,
	createWorkInProgress,
	FiberNode,
	OffscreenProps
} from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
	ContextProvider,
	Fragment,
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	SuspenseComponent,
	OffscreenComponent
} from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane, NoLanes, includeSomeLane } from './fiberLanes';
import {
	ChildDeletion,
	DidCapture,
	Noflags,
	Placement,
	Ref
} from './fiberFlags';
import { pushProvider } from './fiberContext';
import { pushSuspenceHandler } from './suspenseContext';

let didReceiveUpdate = false;

export function markWorkInProgressReceivedUpdate() {
	didReceiveUpdate = true;
}

// beginWork 递归中的向下递归阶段
export const beginWork = (
	wip: FiberNode,
	renderLane: Lane
): FiberNode | null => {
	// bailout策略
	const current = wip.alternate;

	if (current !== null) {
		const oldProps = current.memoizedProps;
		const newProps = wip.pendingProps;

		if (oldProps !== newProps || current.type !== wip.type) {
			didReceiveUpdate = true;
		} else {
			// props和type都没变，检查该fiber是否有待处理的更新
			const hasScheduledStateOrContext = includeSomeLane(
				current.lanes,
				renderLane
			);
			if (!hasScheduledStateOrContext) {
				// 没有待处理的更新，可以bailout
				didReceiveUpdate = false;

				// 特殊处理：ContextProvider和SuspenseComponent需要维护栈
				switch (wip.tag) {
					case ContextProvider: {
						const newValue = wip.pendingProps.value;
						const context = wip.type._context;
						pushProvider(context, newValue);
						break;
					}
					case SuspenseComponent:
						pushSuspenceHandler(wip);
						break;
				}

				return bailoutOnAlreadyFinishedWork(wip, renderLane);
			} else {
				didReceiveUpdate = false;
			}
		}
	} else {
		didReceiveUpdate = false;
	}

	wip.lanes = NoLanes;

	// 比较，返回子fiberNode
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip, renderLane);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip, renderLane);
		case Fragment:
			return updateFragment(wip);
		case ContextProvider:
			return updateContextProvider(wip, renderLane);
		case SuspenseComponent:
			return updateSuspenseComponent(wip, renderLane);
		case OffscreenComponent:
			return updateOffscreenComponent(wip, renderLane);
		default:
			if (__DEV__) {
				console.log('beginWork未实现的类型', wip.tag);
			}
			break;
	}
	return null;
};

function bailoutOnAlreadyFinishedWork(
	wip: FiberNode,
	renderLane: Lane
): FiberNode | null {
	if (!includeSomeLane(wip.childLanes, renderLane)) {
		// 子树也没有待处理的更新，跳过整棵子树
		if (__DEV__) {
			console.log('bailout整棵子树', wip);
		}
		return null;
	}
	// 当前fiber不需要更新，但子树中有更新，克隆children继续向下
	cloneChildFibers(wip);
	return wip.child;
}

function cloneChildFibers(wip: FiberNode): void {
	if (wip.child === null) {
		return;
	}
	let currentChild = wip.child;
	let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
	wip.child = newChild;
	newChild.return = wip;

	while (currentChild.sibling !== null) {
		currentChild = currentChild.sibling;
		const newSibling = createWorkInProgress(
			currentChild,
			currentChild.pendingProps
		);
		newChild.sibling = newSibling;
		newSibling.return = wip;
		newChild = newSibling;
	}
	newChild.sibling = null;
}

function updateOffscreenComponent(wip: FiberNode, renderLane: Lane) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateSuspenseComponent(wip: FiberNode, renderLane: Lane) {
	const current = wip.alternate;
	const nextProps = wip.pendingProps;

	let showFallback = false;
	const didSuspend = (wip.flags & DidCapture) !== Noflags;

	if (didSuspend) {
		showFallback = true;
		wip.flags &= ~DidCapture;
	}

	const nextPrimaryChildren = nextProps.children;
	const nextFallbackChildren = nextProps.fallback;
	pushSuspenceHandler(wip);

	if (current === null) {
		// mount
		if (showFallback) {
			// 挂起
			return mountSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
		} else {
			// 正常
			return mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	} else {
		// update
		if (showFallback) {
			// 挂起
			return updateSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
		} else {
			// 正常
			return updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	}
}

function updateSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
	const current = wip.alternate as FiberNode;
	const currentPrimaryChildFragment = current.child as FiberNode;
	const currentFallbackChildFragment: FiberNode | null =
		currentPrimaryChildFragment.sibling;

	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};

	const primaryChildFragment = createWorkInProgress(
		currentPrimaryChildFragment,
		primaryChildProps
	);
	primaryChildFragment.return = wip;
	primaryChildFragment.sibling = null;
	wip.child = primaryChildFragment;

	if (currentFallbackChildFragment !== null) {
		const deletions = wip.deleions;
		if (deletions === null) {
			wip.deleions = [currentFallbackChildFragment];
			wip.flags |= ChildDeletion;
		} else {
			deletions.push(currentFallbackChildFragment);
		}
	}

	return primaryChildFragment;
}

function updateSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	const current = wip.alternate as FiberNode;
	const currentPrimaryChildFragment = current.child as FiberNode;
	const currentFallbackChildFragment: FiberNode | null =
		currentPrimaryChildFragment.sibling;

	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};

	const primaryChildFragment = createWorkInProgress(
		currentPrimaryChildFragment,
		primaryChildProps
	);
	let fallbackChildFragment;

	if (currentFallbackChildFragment) {
		fallbackChildFragment = createWorkInProgress(
			currentFallbackChildFragment,
			fallbackChildren
		);
	} else {
		fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);
		fallbackChildFragment.flags |= Placement;
	}

	primaryChildFragment.return = wip;
	fallbackChildFragment.return = wip;
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}

function mountSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
	const primaryChildProps: OffscreenProps = {
		mode: 'visible',
		children: primaryChildren
	};

	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
	primaryChildFragment.return = wip;
	wip.child = primaryChildFragment;
	return primaryChildFragment;
}

function mountSuspenseFallbackChildren(
	wip: FiberNode,
	primaryChildren: any,
	fallbackChildren: any
) {
	const primaryChildProps: OffscreenProps = {
		mode: 'hidden',
		children: primaryChildren
	};

	const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
	const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);

	fallbackChildFragment.flags |= Placement;

	primaryChildFragment.return = wip;
	fallbackChildFragment.return = wip;
	primaryChildFragment.sibling = fallbackChildFragment;
	wip.child = primaryChildFragment;

	return fallbackChildFragment;
}

function updateContextProvider(wip: FiberNode, renderLane: Lane) {
	const providerType = wip.type;
	const context = providerType._context;
	const newProps = wip.pendingProps;
	const oldProps = wip.memoizedProps;

	const newValue = newProps.value;

	pushProvider(context, newValue);

	if (oldProps !== null) {
		const oldValue = oldProps.value;
		// context value没变，尝试bailout
		if (
			Object.is(oldValue, newValue) &&
			oldProps.children === newProps.children
		) {
			return bailoutOnAlreadyFinishedWork(wip, renderLane);
		}
	}

	const nextChildren = newProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
	const nextChildren = renderWithHooks(wip, renderLane);

	const current = wip.alternate;
	if (current !== null && !didReceiveUpdate) {
		// state没有变化，bailout
		return bailoutOnAlreadyFinishedWork(wip, renderLane);
	}

	reconcileChildren(wip, nextChildren);
	return wip.child;
}

// hostRoot的beginwork工作流程
// 1、计算状态最新值
// 2、创建子fiberNode节点
function updateHostRoot(wip: FiberNode, renderLane: Lane) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element>;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
	wip.memoizedState = memoizedState;

	const current = wip.alternate;
	if (current !== null) {
		current.memoizedState = memoizedState;
	}

	const nextChildren = wip.memoizedState;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

// hostComponent的beginwork工作流程
// 1、创建子fiberNode节点
// ? 为什么没有 计算状态最新值 我的理解是 hostComponent 没有内部状态，不需要维护
function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	markRef(wip.alternate, wip);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
	const current = wip.alternate;

	// 优化策略，mount阶段大量插入节点，可以构建离屏DOM树，一次性插入
	if (current !== null) {
		// update
		wip.child = reconcileChildFibers(wip, current.child, children);
	} else {
		// mount
		wip.child = mountChildFibers(wip, current, children);
	}
}

function markRef(current: FiberNode | null, workInProgress: FiberNode) {
	const ref = workInProgress.ref;
	if (
		(current === null && ref !== null) ||
		(current !== null && current.ref !== ref)
	) {
		workInProgress.flags |= Ref;
	}
}
