import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes';
import {
	Fragment,
	FunctionComponent,
	HostComponent,
	WorkTag
} from './workTags';
import { Flags, Noflags } from './fiberFlags';
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { CallbackNode } from 'scheduler';

export class FiberNode {
	type: any;
	tag: WorkTag;
	pendingProps: Props;
	key: Key | null;
	stateNode: any;
	ref: Ref;

	return: FiberNode | null;
	child: FiberNode | null;
	sibling: FiberNode | null;
	index: number;

	memoizedProps: Props | null;
	memoizedState: any;
	alternate: FiberNode | null;
	flags: Flags;
	subtreeFlags: Flags;
	updateQueue: unknown;
	deleions: FiberNode[] | null;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		// 实例的属性
		this.tag = tag;
		this.key = key;
		this.stateNode = null; // hostRoot节点才有的指向FiberRootNode
		this.type = null; // 指向函数组件或者类组件

		// 构成树状结构的属性
		this.return = null; // 指向父级fiber
		this.child = null; // 指向第一个子级fiber
		this.sibling = null; // 指向下一个兄弟fiber
		this.index = 0; // 在父级children数组中的索引

		this.ref = null; // ref属性

		// 作为工作单元
		this.pendingProps = pendingProps; // 准备工作前的props
		this.memoizedProps = null; // 工作完以后的props
		this.memoizedState = null; // 更新完成的新state 不同类型组件存的数据不同，函数组件：hook链表
		this.updateQueue = null; // 保存

		this.alternate = null; // 指向另一颗Fiber树

		// 副作用
		this.flags = Noflags; // 用于标记fiber 增删改
		this.subtreeFlags = Noflags; // 用于标记子树的副作用
		this.deleions = null; // 保存所有要删除的子节点
	}
}

export interface PendingPassiveEffects {
	unmount: any[];
	update: any[];
}

export class FiberRootNode {
	container: Container; //保存对应宿主环境挂载的节点
	current: FiberNode;
	finishedWork: FiberNode | null; // 保存整个更新流程完成的hostRootFiber
	pendingLanes: Lanes; // 代表所有未被消费的lane的集合
	finishedLane: Lane; // 代表本次更新消费的lane
	pendingPassiveEffects: PendingPassiveEffects; // 保存effect回调函数

	callbackNode: CallbackNode | null; //
	callbackPriority: Lane;

	constructor(container: Container, hostFiberRoot: FiberNode) {
		this.container = container;
		this.current = hostFiberRoot;
		hostFiberRoot.stateNode = this;
		this.finishedWork = null;
		this.pendingLanes = NoLanes;
		this.finishedLane = NoLane;
		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		};

		this.callbackNode = null;
		this.callbackPriority = NoLane;
	}
}

export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate;

	if (wip === null) {
		// mount
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.stateNode = current.stateNode;

		wip.alternate = current;
		current.alternate = wip;
	} else {
		// update
		wip.pendingProps = pendingProps;
		wip.flags = Noflags;
		wip.subtreeFlags = Noflags;
		wip.deleions = null;
	}
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;

	return wip;
};

// 根据element 创建fiber
export function createFiberFromElement(element: ReactElementType): FiberNode {
	const { type, key, props } = element;
	let fiberTag: WorkTag = FunctionComponent;
	if (typeof type === 'string') {
		fiberTag = HostComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('未定义的type类型', element);
	}
	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key);
	return fiber;
}
