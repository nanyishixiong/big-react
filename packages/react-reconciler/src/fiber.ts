import { Props, Key, Ref } from 'shared/ReactTypes';
import { workTag } from './workTags';
import { Flags, Noflags } from './fiberFlags';
import { Container } from 'hostConfig';

export class FiberNode {
	type: any;
	tag: workTag;
	pendingProps: Props;
	key: Key;
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
	updateQueue: unknown;

	constructor(tag: workTag, pendingProps: Props, key: Key) {
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
		this.memoizedState = null; // 更新完成的新state
		this.updateQueue = null; // 保存

		this.alternate = null; // 指向另一颗Fiber树

		// 副作用
		this.flags = Noflags; // 用于标记fiber 增删改
	}
}

export class FiberRootNode {
	container: Container; //保存对应宿主环境挂载的节点
	current: FiberNode;
	finishedWork: FiberNode | null; // 保存整个更新流程完成的hostRootFiber

	constructor(container: Container, hostFiberRoot: FiberNode) {
		this.container = container;
		this.current = hostFiberRoot;
		hostFiberRoot.stateNode = this;
		this.finishedWork = null;
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
	}
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;

	return wip;
};
