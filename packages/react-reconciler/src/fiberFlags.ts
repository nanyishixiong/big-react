export type Flags = number;

export const Noflags = 0b0000001;
// Placement ChildDeletion 是跟结构相关的变化 Update 是跟属性相关的变化 当然这是对于HostComponent类型的组件而言
export const Placement = 0b0000010;
export const Update = 0b0000100;
export const ChildDeletion = 0b0001000;
