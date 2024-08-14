import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [num, updateNum] = useState(0);
	function handleAlertClick() {
		setTimeout(() => {
			console.log('count', num);
		}, 2000);
	}

	return (
		<>
			<p>count:{num}</p>
			<button onClick={() => updateNum(num + 1)}>click me</button>
			<button onClick={handleAlertClick}>console</button>
		</>
	);
}

// function Child({ children }) {
// 	const now = performance.now();
// 	while (performance.now() - now < 4) {}
// 	return <li>{children}</li>;
// }
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
