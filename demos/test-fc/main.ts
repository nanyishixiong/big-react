import {
	unstable_ImmediatePriority as ImmediatePriority,
	unstable_UserBlockingPriority as UserBlockingPriority,
	unstable_NormalPriority as NormalPriority,
	unstable_LowPriority as LowPriority,
	unstable_IdlePriority as IdlePriority,
	unstable_scheduleCallback as scheduleCallback,
	unstable_shouldYield as shouldYield,
	CallbackNode,
	unstable_getFirstCallbackNode as getFirstCallbackNode,
	unstable_cancelCallback as cancelCallback
} from 'scheduler';
import './style.css';

const root = document.querySelector('#root');

interface Work {
	count: number;
	priority: Priority;
}

type Priority =
	| typeof IdlePriority
	| typeof LowPriority
	| typeof NormalPriority
	| typeof UserBlockingPriority
	| typeof ImmediatePriority;

const workList: Work[] = [];
let prevPriority: Priority = IdlePriority;
let curCallback: CallbackNode | null = null;

[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach(
	(priority) => {
		const button = document.createElement('button');
		button.innerText = [
			'',
			'ImmediatePriority',
			'UserBlockingPriority',
			'NormalPriority',
			'LowPriority'
		][priority];
		root?.appendChild(button);
		button.onclick = () => {
			workList.unshift({
				count: 200,
				priority: priority as Priority
			});
			schedule();
		};
	}
);

function schedule() {
	const cbNode = getFirstCallbackNode();
	// 取到最高优先级work
	const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0];

	//  策略逻辑
	if (!curWork) {
		curCallback = null;
		cbNode && cancelCallback(cbNode);
		return;
	}

	const { priority: curPriority } = curWork;
	if (curPriority === prevPriority) {
		return;
	}

	// 更高优先级work
	cbNode && cancelCallback(cbNode);

	curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));
}

function perform(work: Work, didTimeout?: boolean) {
	/**
	 * 影响是否可以中断的因素
	 * 1. priority 如果是同步优先级就不可中断，其他优先级就可以中断
	 * 2. 饥饿问题 work一直得不到执行，优先级会越来越高
	 * 3. 时间切片 时间用完了就应该中断
	 **/
	// 优先级为同步，或任务过期了就应该同步执行
	const needSync = work.priority === ImmediatePriority || didTimeout;
	// shouldYield时间切片还有剩时间
	while ((needSync || !shouldYield()) && work.count) {
		work.count--;
		insertSpan(work.priority + '');
	}

	// react怎么从中断处继续执行
	prevPriority = work.priority;
	// 当work执行完，就从任务队列中移除，没执行完会继续留在队列中等待调度
	if (!work.count) {
		const workIndex = workList.indexOf(work);
		workList.splice(workIndex, 1);
		prevPriority = IdlePriority;
	}

	const prevCallback = curCallback;
	schedule();
	const newCallback = curCallback;

	if (newCallback && newCallback === prevCallback) {
		// 返回值是回调函数，会继续被调度
		return perform.bind(null, work);
	}
}

function insertSpan(content) {
	const span = document.createElement('span');
	span.innerText = content;
	span.className = `pri-${content}`;
	doSomeBuzeWork(10000000);
	root?.appendChild(span);
}

function doSomeBuzeWork(len: number) {
	let result = 0;
	while (len--) {
		result += len;
	}
}
