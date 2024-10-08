import {
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority,
	unstable_getCurrentPriorityLevel
} from 'scheduler';
import { FiberRootNode } from './fiber';
import ReactCurrentBatchConfig from 'react/src/currentBatchConfig';

export type Lane = number; // 优先级
export type Lanes = number; // 一批优先级

export const SyncLane = 0b00001; // 同步优先级
export const InputContinuousLane = 0b00010; // 连续输入
export const DefaultLane = 0b00100;
export const TransitionLane = 0b01000;
export const IdleLane = 0b010000;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
	return laneA | laneB;
}

export function requestUpdateLane() {
	// transition lane
	const isTransition = ReactCurrentBatchConfig.transition !== null;
	if (isTransition) {
		return TransitionLane;
	}
	// 从上下文环境获取优先级
	const currentPriority = unstable_getCurrentPriorityLevel();
	const lane = schedulerPriorityToLane(currentPriority);
	return lane;
}

/**
 * 选出最高优先级lane
 * @param lanes
 * @returns
 */
export function getHighestPriorityLane(lanes: Lanes): Lane {
	return lanes & -lanes;
}

/**
 * 移除lane
 * @param root
 * @param lane
 */
export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;

	root.suspendedLanes = NoLanes;
	root.pendingLanes = NoLanes;
}

/**
 * 比较优先级是否足够
 * @param set
 * @param subset
 * @returns
 */
export function isSubsetOfLanes(set: Lanes, subset: Lane) {
	return (set & subset) === subset;
}

export function lanesToSchedulerPriority(lanes: Lanes) {
	const lane = getHighestPriorityLane(lanes);

	if (lane === SyncLane) {
		return unstable_ImmediatePriority;
	}
	if (lane === InputContinuousLane) {
		return unstable_UserBlockingPriority;
	}
	if (lane === DefaultLane) {
		return unstable_NormalPriority;
	}
	return unstable_IdlePriority;
}

export function schedulerPriorityToLane(schedulerPriority: number) {
	if (schedulerPriority === unstable_ImmediatePriority) {
		return SyncLane;
	}
	if (schedulerPriority === unstable_UserBlockingPriority) {
		return InputContinuousLane;
	}
	if (schedulerPriority === unstable_NormalPriority) {
		return DefaultLane;
	}
	return NoLane;
}

// 标记挂起 将lane保存到suspendedLanes 将lane从pendingLanes中移除
export function markRootSuspended(root: FiberRootNode, suspenedLanes: Lanes) {
	root.suspendedLanes |= suspenedLanes;
	root.pendingLanes &= ~suspenedLanes;
}

// 标记ping
export function markRootPinged(root: FiberRootNode, pingedLanes: Lanes) {
	root.pingedLanes |= root.suspendedLanes & pingedLanes;
}

export function getNextLane(root: FiberRootNode): Lane {
	const pendingLanes = root.pendingLanes;

	if (pendingLanes === NoLanes) {
		return NoLane;
	}

	let nextLane = NoLane;

	// pendingLanes 中没有被挂起的lane
	const suspendedLanes = pendingLanes & ~root.suspendedLanes;
	if (suspendedLanes !== NoLanes) {
		nextLane = getHighestPriorityLane(suspendedLanes);
	} else {
		// 所有的lane都是被挂起的 但是可能有已经结束挂起的lane也就是pingedLane
		const pingedLanes = pendingLanes & root.pingedLanes;
		if (pingedLanes !== NoLanes) {
			nextLane = getHighestPriorityLane(pingedLanes);
		}
	}
	return nextLane;
}
