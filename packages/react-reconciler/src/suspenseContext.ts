import { FiberNode } from './fiber';

const suspenceHandlerStack: FiberNode[] = [];
export function getSuspenceHandler() {
	return suspenceHandlerStack[suspenceHandlerStack.length - 1];
}

export function pushSuspenceHandler(fiber: FiberNode) {
	suspenceHandlerStack.push(fiber);
}

export function popSuspenceHandler() {
	suspenceHandlerStack.pop();
}
