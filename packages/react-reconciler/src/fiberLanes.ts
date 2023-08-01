import {
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority,
	unstable_getCurrentPriorityLevel
} from 'scheduler';
import { FiberRootNode } from './fiber';

export type Lane = number; // 优先级
export type Lanes = number; // 一批优先级

export const SyncLane = 0b0001; // 同步优先级
export const InputContinuousLane = 0b0010; // 连续输入
export const DefaultLane = 0b0100;
export const IdleLane = 0b1000;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
	return laneA | laneB;
}

export function requestUpdateLane() {
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
