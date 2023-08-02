import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
	const [isD, setIsd] = useState(false);
	const ref = useRef(null);

	console.log('render', ref.current);

	useEffect(() => {
		console.log('effect', ref.current);
	}, []);

	return (
		<div ref={ref} onClick={() => setIsd(true)}>
			{isD ? null : <Child />}
		</div>
	);
}

function Child() {
	return <div ref={(ref) => console.log(`dom is`, ref)}>Child</div>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
