import { Wakeable } from 'shared/ReactTypes';
import { FiberRootNode } from './fiber';
import { Lane, markRootPinged } from './fiberLanes';
import { ensureRootIsScheduled, markRootUpdated } from './workLoop';
import { getSuspenceHandler } from './suspenseContext';
import { ShouldCapture } from './fiberFlags';

export function throwException(root: FiberRootNode, value: any, lane: Lane) {
	// Error Boundray
	// thenable
	if (
		value !== null &&
		typeof value === 'object' &&
		typeof value.then === 'function'
	) {
		const wakeable: Wakeable<any> = value;
		const suspenseBoundary = getSuspenceHandler();
		if (suspenseBoundary) {
			suspenseBoundary.flags |= ShouldCapture;
		}
		attachpingListener(root, wakeable, lane);
	}
}

function attachpingListener(
	root: FiberRootNode,
	wakeable: Wakeable<any>,
	lane: Lane
) {
	let pingCache = root.pingCache;
	// weakMap{promise: Set<Lane>}
	let threadIDs: Set<Lane> | undefined;
	if (pingCache === null) {
		threadIDs = new Set<Lane>();
		pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>();
		pingCache.set(wakeable, threadIDs);
	} else {
		threadIDs = pingCache.get(wakeable);
		if (threadIDs === undefined) {
			threadIDs = new Set<Lane>();
			pingCache.set(wakeable, threadIDs);
		}
	}
	if (!threadIDs.has(lane)) {
		threadIDs.add(lane);
		function ping() {
			// 触发更新
			if (pingCache !== null) {
				pingCache.delete(wakeable);
			}
			markRootPinged(root, lane);
			markRootUpdated(root, lane);
			ensureRootIsScheduled(root);
		}
		wakeable.then(ping, ping);
	}
}
