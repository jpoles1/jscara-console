import { WorkerMsg, WorkerCmd, MasterCmd } from "@/serialtypes";

let send_buffer: string[] = [];

addEventListener('message', event => {
    const msg: WorkerMsg = event.data
    console.log(msg)
    if (msg.type == MasterCmd.SerialConnect) {
        console.log("TESTSTSTS")
        serial_connect();
    }
    if (msg.type == MasterCmd.PushToBuffer) {
        send_buffer = send_buffer.concat(msg.data);
    }
    else if (msg.type == MasterCmd.ReplaceBuffer) {
        send_buffer = msg.data;
    }
    else if (msg.type == MasterCmd.ClearBuffer) {
        send_buffer = [];
    }
    
});

const async_wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
 
const serial_connect = async function() {
    let port = (await (self.navigator as any).serial.getPorts())[0]
    // Wait for the port to open.
    let port_open_error = "" as any;
    let attempting_to_connect = true;
    while (port_open_error != undefined) {
        port_open_error = undefined;
        await port.open({ baudRate: 250000 }).catch((e: any) => {
            postMessage({ type: WorkerCmd.SerialError, data: `Failed to open serial connection: ${e}` } as WorkerMsg)
            //this.$toast(`Failed to open serial connection: ${e}`)
            port_open_error = e;
        });
        /*if (this.cancel_connect) {
            this.cancel_connect = false;
            this.attempting_to_connect = false;
            return;
        }*/
        if (port_open_error != undefined) {
            await async_wait(1500);
        }
    }
    // Connected successfully
    console.log("YAY")
    postMessage({ type: WorkerCmd.SerialConnected } as WorkerMsg)

    // Setup Writer
    const encoder = new TextEncoderStream();
    const outputDone = encoder.readable.pipeTo(port.writable);
    const output_stream = encoder.writable;
    const writer = output_stream.getWriter();

    // Setup Reader 
    const decoder = new TextDecoderStream();
    const inputDone = port.readable.pipeTo(decoder.writable);
    const inputStream = decoder.readable;
    const reader = inputStream.getReader();

    let ready_to_send = true;
    let last_send = Date.now();
    let last_resp = Date.now();

    const write_interval = setInterval(async () => {
        if (send_buffer.length > 0) {
            if (ready_to_send) {
                console.log(Date.now() - last_send);
                last_send = Date.now();
                ready_to_send = false;
                writer.write(send_buffer.shift() + "\n");
                //writer.releaseLock();
            }
            /*else if((Date.now() - (last_resp || 0)) / 1000 > 1) {
                writer.write("?\n");
            }*/
        }
    }, 1)

    let recv_buffer = "";
    const read_interval = setInterval(async () => {
        let { value, done } = await reader.read();
        if (value) {
            recv_buffer += value;
            if (recv_buffer.includes("\n")){
                if(recv_buffer.includes("ok")) {
                    last_resp = Date.now();
                    ready_to_send = true;
                } else {
                    // Don't bother recording "ok" to serial log
                    recv_buffer = recv_buffer.replace("\n", "<br>")
                    postMessage({ type: WorkerCmd.SerialRecv, data: recv_buffer});
                }
                // else if (this.recv_buffer.includes("error:")) {}
                recv_buffer = "";
            }
        }
        if (done) {
            reader.releaseLock();
        }
    }, 1);
}
