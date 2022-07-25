import { WorkerMsg, WorkerCmd, MasterCmd } from "@/serialtypes";

const ctx: Worker = self as any;

let send_buffer: string[] = [];
let job = {
    active: false,
    gcode_lines: 0,
    lines_sent: 0,
    prog_line_interval: 20, //Number of lines to send between each progress update
};

ctx.addEventListener('message', event => {
    const msg: WorkerMsg = event.data
    if (msg.type == MasterCmd.SerialConnect) {
        serial_connect();
    }
    if (msg.type == MasterCmd.PushToBuffer) {
        send_buffer = send_buffer.concat(msg.data);
    }
    else if (msg.type == MasterCmd.ReplaceBuffer) {
        send_buffer = msg.data;
        job.active = false;
    }
    else if (msg.type == MasterCmd.ClearBuffer) {
        send_buffer = [];
        job.active = false;
    }
    else if (msg.type == MasterCmd.StartJob) {
        send_buffer = msg.data;
        job.gcode_lines = send_buffer.length;
        job.lines_sent = 0;
        job.active = true;
    }
    
});

const async_wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
 
const serial_connect = async function() {
    const port_list = (await ((ctx as any).navigator as any).serial.getPorts());
    //console.log(port_list)
    let port = port_list[0]
    // Wait for the port to open.
    let port_open_error = "" as any;
    let attempting_to_connect = true;
    while (port_open_error != undefined) {
        port_open_error = undefined;
        await port.open({ baudRate: 250000 }).catch((e: any) => {
            ctx.postMessage({ type: WorkerCmd.SerialError, data: `Failed to open serial connection: ${e}` } as WorkerMsg)
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
    ctx.postMessage({ type: WorkerCmd.SerialConnected } as WorkerMsg)

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
                // Log time since last cmd
                //console.log(Date.now() - last_send);
                last_send = Date.now();
                ready_to_send = false;
                writer.write(send_buffer.shift() + "\n");
                job.lines_sent++;
                if(job.lines_sent == job.gcode_lines) {
                    ctx.postMessage({ type: WorkerCmd.JobProg, data: 100 })
                } else if(job.lines_sent % job.prog_line_interval == 0) {
                    ctx.postMessage({ type: WorkerCmd.JobProg, data: 100 * job.lines_sent / job.gcode_lines})
                }
                //writer.releaseLock();
            }
            else if((Date.now() - (last_resp || 0)) / 1000 > 1000) {
                console.log("no resp")
                ready_to_send = true;
            }
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
                } 
                recv_buffer = recv_buffer.replace(/ok/g, "");
                if(recv_buffer.trim() != "") {
                    // Don't bother recording "ok" to serial log
                    recv_buffer = recv_buffer.replace("\n", "<br>")
                    ctx.postMessage({ type: WorkerCmd.SerialRecv, data: recv_buffer});
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
