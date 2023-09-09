import React, { createContext, useContext } from 'react';
import ReactDOM from 'react-dom/client';

const ctxA = createContext('A');
const ctxB = createContext('B');

function App() {
	return (
		<ctxA.Provider value={'A0'}>
			<ctxB.Provider value={'B0'}>
				<ctxA.Provider value={'A1'}>
					<Cpn />
				</ctxA.Provider>
				<Cpn />
			</ctxB.Provider>
			<Cpn />
		</ctxA.Provider>
	);
}

function Cpn() {
	const a = useContext(ctxA);
	const b = useContext(ctxB);
	console.log('A: ', a, 'B: ', b);

	return (
		<div>
			A: {a} B: {b}
		</div>
	);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
);
