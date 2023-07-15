// 以下是打在hook上的标识，代表副作用的类别，以及本次更新是否有触发effect回调

export const HookHasEffect = 0b0001; // 是否需要触发effect回调
export const Passive = 0b0010; // 对于effect hook，Passive代表useEffect这个hook对应的effect
