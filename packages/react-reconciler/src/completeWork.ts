import {
	appendInitialChild,
	createInstance,
	createTextInstance
} from 'hostConfig';
import { FiberNode } from './fiber';
import { HostComponent, HostRoot, HostText } from './workTags';
import { Noflags } from './fiberFlags';

// completeWork 递归中的回溯阶段
export const completeWork = (wip: FiberNode) => {
	const newProps = wip.pendingProps;
	const current = wip.alternate;

	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				//update
			} else {
				// 1、构建DOM
				const instance = createInstance(wip.type, newProps);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				//update
			} else {
				// 1、构建DOM
				const instance = createTextInstance(newProps.content);
				// 2、将DOM插入到DOM树中
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostRoot:
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.log('未处理的completeWork', wip);
			}
			break;
	}
};

function appendAllChildren(parent: FiberNode, wip: FiberNode) {
	let node = wip.child;

	// 多叉树的前序遍历，向下遍历子节点，然后递归遍历兄弟节点，最后回溯
	while (node !== null) {
		if (node.tag === HostComponent || node.tag === HostText) {
			appendInitialChild(parent, node?.stateNode);
		} else if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === wip) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return;
			}
			node = node.return;
		}

		node.sibling.return = node.return;
		node = node.sibling;
	}
}

// 将子fiberNode的flags冒泡到父fiberNode，从父节点可以知道子节点有没有需要增删改，有的话则向下递归遍历子树
function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = Noflags;
	let child = wip.child;

	while (child !== null) {
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}

	wip.subtreeFlags |= subtreeFlags;
}
