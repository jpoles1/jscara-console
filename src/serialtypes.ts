export interface WorkerMsg {
    type: MasterCmd | WorkerCmd
    data: any 
}

export enum MasterCmd {
    SerialConnect,
    PushToBuffer,
    ReplaceBuffer,
    ClearBuffer,
}

export enum WorkerCmd {
    SerialConnected,
    SerialError,
    SerialRecv,
}