import { FiberNode } from './fiber';
import { popProvider } from './fiberContext';
import { DidCapture, Noflags, ShouldCapture } from './fiberFlags';
import { popSuspenceHandler } from './suspenseContext';
import { ContextProvider, SuspenseComponent } from './workTags';

export function unwindWork(wip: FiberNode) {
	const flags = wip.flags;
	switch (wip.tag) {
		case SuspenseComponent:
			popSuspenceHandler();
			if (
				(flags & ShouldCapture) !== Noflags &&
				(flags & DidCapture) === Noflags
			) {
				wip.flags = (flags & ~ShouldCapture) | DidCapture;
				return wip;
			}
			break;
		case ContextProvider:
			const context = wip.type._context;
			popProvider(context);
			break;
		default:
			break;
	}
	return null;
}
