import {
	Container,
	Instance,
	appendChildToContainer,
	commitUpdate,
	hideInstance,
	hideTextInstance,
	insertChildToContainer,
	removeChild,
	unhideInstance,
	unhideTextInstance
} from 'hostConfig';
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber';
import {
	MutationMask,
	Noflags,
	Placement,
	Update,
	ChildDeletion,
	PassiveEffect,
	Flags,
	LayoutMask,
	Ref,
	Visibility
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
	OffscreenComponent
} from './workTags';
import { Effect, FCUpdateQueue } from './fiberHooks';
import { HookHasEffect } from './hookEffectTags';

let nextEffect: FiberNode | null = null;

export const commitEffects = (
	phrase: 'mutation' | 'layout',
	mask: Flags,
	callback: (fiber: FiberNode, root: FiberRootNode) => void
) => {
	return (finishedWork: FiberNode, root: FiberRootNode) => {
		nextEffect = finishedWork;

		while (nextEffect !== null) {
			const child: FiberNode | null = nextEffect.child;
			// 向下遍历找到有副作用的节点，在回溯阶段进行副作用操作
			if ((nextEffect.subtreeFlags & mask) !== Noflags && child !== null) {
				nextEffect = child;
			} else {
				// 向上回溯 DFS
				up: while (nextEffect !== null) {
					callback(nextEffect, root);
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
};

const commitMutationEffectsOnFiber = (
	finishedWork: FiberNode,
	root: FiberRootNode
) => {
	const { flags, tag } = finishedWork;

	// 如果存在 Placement 的副作用
	if ((flags & Placement) !== Noflags) {
		// 执行添加DOM操作
		commitPlacement(finishedWork);
		// 删除Placement的副作用标记
		finishedWork.flags &= ~Placement;
	}

	// 如果存在 Update 的副作用
	if ((flags & Update) !== Noflags) {
		// 执行更新DOM操作
		commitUpdate(finishedWork);
		// 删除Update的副作用标记
		finishedWork.flags &= ~Update;
	}

	// 如果存在 ChildDeletion 的副作用
	if ((flags & ChildDeletion) !== Noflags) {
		const deletions = finishedWork.deleions;
		if (deletions !== null) {
			// 对数组中的节点逐一删除
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete, root);
			});
		}
		// 删除ChildDeletion的副作用标记
		finishedWork.flags &= ~ChildDeletion;
	}

	// 如果存在 PassiveEffect 的副作用
	if ((flags & PassiveEffect) !== Noflags) {
		// 收集回调
		commitPassiveEffect(finishedWork, root, 'update');
		// 删除PassiveEffect的副作用标记
		finishedWork.flags &= ~PassiveEffect;
	}

	// 如果存在 Ref 的副作用 解绑ref
	if ((flags & Ref) !== Noflags && tag === HostComponent) {
		// 解绑Ref
		safelydiDetachRef(finishedWork);
	}

	//
	if ((flags & Visibility) !== Noflags && tag === OffscreenComponent) {
		const isHidden = finishedWork.pendingProps.mode === 'hidden';
		hideOrUnhideAllChildren(finishedWork, isHidden);
		finishedWork.flags &= ~Visibility;
	}
};

function hideOrUnhideAllChildren(finishedWork: FiberNode, isHidden: boolean) {
	findHostSubtreeRoot(finishedWork, (hostRoot) => {
		const instance = hostRoot.stateNode;
		if (hostRoot.tag === HostComponent) {
			isHidden ? hideInstance(instance) : unhideInstance(instance);
		} else if (hostRoot.tag === HostText) {
			isHidden
				? hideTextInstance(instance)
				: unhideTextInstance(instance, hostRoot.memoizedProps.content);
		}
	});
}

function findHostSubtreeRoot(
	finishedWork: FiberNode,
	callback: (hostSubtreeRoot: FiberNode) => void
) {
	let node = finishedWork;
	let hostSubtreeRoot = null;

	while (true) {
		if (node.tag === HostComponent) {
			if (hostSubtreeRoot === null) {
				hostSubtreeRoot = node;
				callback(node);
			}
		} else if (node.tag === HostText) {
			if (hostSubtreeRoot === null) {
				callback(node);
			}
		} else if (
			node.tag === OffscreenComponent &&
			node.pendingProps.mode === 'hidden' &&
			node !== finishedWork
		) {
			// 什么都不做
		} else if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === finishedWork) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === finishedWork) {
				return;
			}
			if (hostSubtreeRoot === node) {
				hostSubtreeRoot = null;
			}

			node = node.return;
		}

		if (hostSubtreeRoot === node) {
			hostSubtreeRoot = null;
		}

		node.sibling.return = node.return;
		node = node.sibling;
	}
}

const commitLayoutEffectsOnFiber = (finishedWork: FiberNode) => {
	const { flags, tag } = finishedWork;

	// 如果存在 Ref 的副作用 HostComponent 类型才有 stateNode DOM节点
	if ((flags & Ref) !== Noflags && tag === HostComponent) {
		// 绑定新的Ref
		safelyAttachRef(finishedWork);
		// 删除 Ref 的副作用标记
		finishedWork.flags &= ~Ref;
	}
};

// 绑定ref
function safelyAttachRef(fiber: FiberNode) {
	const ref = fiber.ref;
	if (ref !== null) {
		const instance = fiber.stateNode;
		if (typeof ref === 'function') {
			ref(instance);
		} else {
			ref.current = instance;
		}
	}
}

// 解绑ref
function safelydiDetachRef(current: FiberNode) {
	const ref = current.ref;
	if (ref !== null) {
		if (typeof ref === 'function') {
			ref(null);
		} else {
			ref.current = null;
		}
	}
}

export const commitMutationEffects = commitEffects(
	'mutation',
	MutationMask | PassiveEffect,
	commitMutationEffectsOnFiber
);

export const commitLayoutEffects = commitEffects(
	'layout',
	LayoutMask,
	commitLayoutEffectsOnFiber
);

/**
 * 收集effect，在commit阶段将所有有副作用的Effect（副作用指删除或更新或新建），保存到fiber树根节点，
 * commit结束之后，将所有副作用处理，先执行所有删除节点的effect销毁函数，再执行创建函数。
 */
function commitPassiveEffect(
	fiber: FiberNode,
	root: FiberRootNode,
	type: keyof PendingPassiveEffects
) {
	if (
		fiber.tag !== FunctionComponent ||
		(type === 'update' && (fiber.flags & PassiveEffect) === Noflags)
	) {
		return;
	}
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
	if (updateQueue !== null) {
		if (updateQueue.lastEffect === null && __DEV__) {
			console.error('当FC存在PassiveEffect flag时，不应该不存在Effect');
		}
		root.pendingPassiveEffects[type].push(updateQueue.lastEffect);
	}
}

function commitHookEffectList(
	flags: Flags,
	lastEffect: Effect,
	callback: (effect: Effect) => void
) {
	let effect = lastEffect.next as Effect;
	do {
		if ((effect.tag & flags) === flags) {
			callback(effect);
		}
		effect = effect.next as Effect;
	} while (effect !== lastEffect.next);
}

export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destory = effect.destroy;
		if (typeof destory === 'function') {
			destory();
		}
		effect.tag &= ~HookHasEffect;
	});
}

export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const destory = effect.destroy;
		if (typeof destory === 'function') {
			destory();
		}
	});
}

export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
	commitHookEffectList(flags, lastEffect, (effect) => {
		const create = effect.create;
		if (typeof create === 'function') {
			effect.destroy = create();
		}
	});
}

function recordHostChildrenToDelete(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	// 1、找到第一个root host节点
	const lastOne = childrenToDelete[childrenToDelete.length - 1];

	if (!lastOne) {
		childrenToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber);
			}
			node = node.sibling;
		}
	}
	// 2、每找到一个host节点 判断这个节点是不是1找到的那个节点的兄弟节点
}

// 删除实际是删除子树，子树中可能有不同类型的节点，需要不同的处理，因此需要递归处理子树
function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
	const rootChildrenToDelete: FiberNode[] = [];

	// 递归子树
	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				// 解绑ref
				safelydiDetachRef(unmountFiber);
				return;
			case HostText:
				recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
				return;
			case FunctionComponent:
				// TODO useEffect unmount
				commitPassiveEffect(unmountFiber, root, 'unmount');
				return;
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber);
				}
		}
	});

	// 移除rootHostNode的DOM
	if (rootChildrenToDelete.length) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((node) => {
				removeChild(node.stateNode, hostParent);
			});
		}
	}
	childToDelete.return = null;
	childToDelete.child = null;
}

function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root;
	while (true) {
		onCommitUnmount(node);

		if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		// 终止条件
		if (node === root) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

const commitPlacement = (finishedWork: FiberNode) => {
	if (__DEV__) {
		console.warn('执行Placement操作', finishedWork);
	}
	// 找到要挂载的父节点 parent DOM 容器
	const hostParent = getHostParent(finishedWork);

	// host sibling
	const sibling = getHostSibling(finishedWork);
	// 递归遍历子树，向容器添加新增的节点
	if (hostParent !== null) {
		insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
	}
};

// 找到要插入位置的节点 parentNode.insertBefore 找到这个 parentNode
function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber;

	findSibling: while (true) {
		while (node.sibling === null) {
			// 找不到兄弟节点就向上找父节点的兄弟节点
			const parent = node.return;
			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				return null;
			}
			node = parent;
		}
		node.sibling.return = node.return;
		node = node.sibling;
		while (node.tag !== HostText && node.tag !== HostComponent) {
			// 向下遍历
			// 处于移动状态的节点不能作为目标兄弟host节点
			if ((node.flags & Placement) !== Noflags) {
				continue findSibling;
			}
			if (node.child === null) {
				continue findSibling;
			} else {
				node.child.return = node;
				node = node.child;
			}
		}
		if ((node.flags & Placement) === Noflags) {
			return node.stateNode;
		}
	}
}

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
function insertOrAppendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container,
	before?: Instance
) {
	// finishedWork 不一定是host类型的Fiber 需要向下递归找到host类型fiber
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		// 新增节点的DOM操作
		if (before) {
			insertChildToContainer(finishedWork.stateNode, hostParent, before);
		} else {
			appendChildToContainer(hostParent, finishedWork.stateNode);
		}
		return;
	}

	const child = finishedWork.child;
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;
		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}
