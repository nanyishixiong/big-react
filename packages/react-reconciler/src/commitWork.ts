import { Container, appendChildToContainer } from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import { MutationMask, Noflags, Flags, Placement } from './fiberFlags';
import { HostComponent, HostRoot, HostText } from './workTags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;

	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;
		// 向下遍历找到有副作用的节点，在回溯阶段进行副作用操作
		if (
			(nextEffect.subtreeFlags & MutationMask) !== Noflags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			// 向上回溯 DFS
			up: while (nextEffect !== null) {
				commitMutationEffectsOnFIber(nextEffect);
				const sibling: FiberNode | null = nextEffect.sibling;

				if (sibling !== null) {
					nextEffect = sibling;
					break up;
				}
				nextEffect = nextEffect.return;
			}
		}
	}
};

const commitMutationEffectsOnFIber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;

	// 如果存在 Placement 的副作用
	if ((flags & Placement) !== Noflags) {
		// 执行添加DOM操作
		commitPlacement(finishedWork);
		// 删除Placement的副作用标记
		finishedWork.flags &= ~Placement;
	}

	// flags Update
	// flags ChildDeletion
};

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork);
	}
	// 找到要挂载的父节点 parent DOM 容器
	const hostParent = getHostParent(finishedWork);
	// 递归遍历子树，向容器添加新增的节点
	if (hostParent !== null) {
		appendPlacementNodeIntoContainer(finishedWork, hostParent);
	}
};

// 找到要挂载的宿主容器
function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return;
	while (parent) {
		const parentTag = parent.tag;
		// 挂载的容器有两种 HostComponent 和 HostRoot
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}
		parent = parent.return;
	}
	if (__DEV__) {
		console.error('未找到父节点');
	}
	return null;
}

// 将新增节点挂载到容器中
function appendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container
) {
	// finishedWork 不一定是host类型的Fiber 需要向下递归找到host类型fiber
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		// 新增节点的DOM操作
		appendChildToContainer(hostParent, finishedWork.stateNode);
		return;
	}

	const child = finishedWork.child;
	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;
		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}
