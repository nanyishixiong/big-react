// 判断宿主环境是否支持Symbol
// Symbol.for(https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Symbol/for)
const supportSymbol = typeof Symbol === 'function' && Symbol.for;

// 如果支持Symbol，就用Symbol.for创建一个唯一的Symbol值，否则就用0xeac7
export const REACT_ELEMENT_TYPE = supportSymbol
	? Symbol.for('react.element')
	: 0xeac7;

export const REACT_FRAGMENT_TYPE = supportSymbol
	? Symbol.for('react.fragment')
	: 0xeacb;

export const REACT_CONTEXT_TYPE = supportSymbol
	? Symbol.for('react.context')
	: 0xeacc;

export const REACT_PROVIDER_TYPE = supportSymbol
	? Symbol.for('react.provider')
	: 0xeac2;

export const REACT_SUSPENSE_TYPE = supportSymbol
	? Symbol.for('react.suspence')
	: 0xeac2;
