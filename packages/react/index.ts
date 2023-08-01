import { Dispatcher, resolveDispatcher } from './src/currentDispatcher';
import { jsx, jsxDEV, isValidElement as isValidElementFn } from './src/jsx';
import currentDispatcher from './src/currentDispatcher';
import currentBatchConfig from './src/currentBatchConfig';

export const useState: Dispatcher['useState'] = (initialState: any) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useEffect(create, deps);
};

export const useTransition: Dispatcher['useTransition'] = () => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useTransition();
};

// 内部数据共享层
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED__ = {
	currentDispatcher,
	currentBatchConfig
};

export const version = '0.0.0';
// TODO 根据环境区分使用jsx/jsxDEV
export const createElement = jsx;
export const isValidElement = isValidElementFn;
