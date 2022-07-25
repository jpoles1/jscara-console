export interface WorkerMsg {
    type: MasterCmd | WorkerCmd
    data: any 
}

export enum MasterCmd {
    SerialConnect,
    PushToBuffer,
    ReplaceBuffer,
    ClearBuffer,
    StartJob,
}

export enum WorkerCmd {
    SerialConnected,
    SerialError,
    SerialRecv,
    JobProg,
}