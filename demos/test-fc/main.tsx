import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, setNum] = useState(1);
	const arr =
		num % 2 === 0
			? [<li key={1}>1</li>, <li key={2}>2</li>, <li key={3}>3</li>]
			: [<li key={3}>3</li>, <li key={2}>2</li>, <li key={1}>1</li>];
	return (
		<ul onClickCapture={() => setNum(num + 1)}>
			<>
				<li key={4}>4</li>
				<li key={5}>5</li>
			</>
			{arr}
		</ul>
	);
}
function Child() {
	return <span>big-react function Component</span>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
