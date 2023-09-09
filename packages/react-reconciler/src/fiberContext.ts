import { ReactContext } from 'shared/ReactTypes';

let preContextValue: any = null;
const preContextValueStack: any[] = [];

export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
	preContextValueStack.push(preContextValue);
	preContextValue = context._currentValue;
	context._currentValue = newValue;
}

export function popProvider<T>(context: ReactContext<T>) {
	context._currentValue = preContextValue;
	preContextValue = preContextValueStack.pop();
}
