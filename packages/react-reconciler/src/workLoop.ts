import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber';
import { HostRoot } from './workTags';
let workInProgress: FiberNode | null = null;

function prepareFreshStack(root: FiberRootNode) {
	workInProgress = createWorkInProgress(root.current, {});
}

// 在Fiber中调度Update
export function scheduleUpdateOnFiber(fiber: FiberNode) {
	// TODO 调度功能
	// fiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	// 拿到fiberRootNode，再从根节点向下更新
	renderRoot(root);
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

function renderRoot(root: FiberRootNode) {
	// 初始化 workInProgress 指向要开始递归的根节点
	prepareFreshStack(root);
	do {
		try {
			// 进入工作循环
			workLoop();
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop出现错误', e);
			}
			workInProgress = null;
		}
	} while (true);

	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;

	//  wip fiberNode树 树中的flags 执行DOM操作
	// commitRoot(root);
}

function workLoop() {
	// 开始递归
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	const next = beginWork(fiber);
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
