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
import { Lane } from './fiberLanes';
import { ChildDeletion, Placement, Ref } from './fiberFlags';
import { pushProvider } from './fiberContext';
// beginWork 递归中的向下递归阶段
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
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
			return updateContextProvider(wip);
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

function updateSuspenseComponent(wip: FiberNode, renderLane: Lane) {
	const current = wip.alternate;
	const nextProps = wip.pendingProps;

	let showFallback = false;
	const didSuspend = false;
	if (didSuspend) {
		showFallback = true;
	}

	const nextPrimaryChildren = nextProps.children;
	const nextFallbackChildren = nextProps.fallback;

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
			mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
		}
	} else {
		// update
		if (showFallback) {
			// 挂起
			updateSuspenseFallbackChildren(
				wip,
				nextPrimaryChildren,
				nextFallbackChildren
			);
		} else {
			// 正常
			updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
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

function updateOffscreenComponent(wip: FiberNode, renderLane: Lane) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateContextProvider(wip: FiberNode) {
	const providerType = wip.type;
	const context = providerType._context;
	const newProps = wip.pendingProps;

	pushProvider(context, newProps.value);

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
