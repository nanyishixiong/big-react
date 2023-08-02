export type Flags = number;

export const Noflags = 0b00000000000000000000000000;
// Placement ChildDeletion 是跟结构相关的变化 Update 是跟属性相关的变化 当然这是对于HostComponent类型的组件而言
export const Placement = 0b00000000000000000000000010;
export const Update = 0b00000000000000000000000100;
export const ChildDeletion = 0b00000000000000000000010000;

export const PassiveEffect = 0b00000000000000000000100000; // 对于fiber节点，新增PassiveEffect，代表本次更新存在副作用
export const Ref = 0b00000000000000000001000000; // 对于fiber节点，新增PassiveEffect，代表本次更新存在副作用

// mutation 阶段需要执行的操作
export const MutationMask = Placement | Update | ChildDeletion | Ref;
// Layout 阶段需要执行的操作
export const LayoutMask = Ref;
// 本次更新需要触发useEffect 卸载阶段也需要触发useEffect，return一个函数在卸载阶段触发
export const PassiveMask = PassiveEffect | ChildDeletion;
