interface EffectorPos {
    X?: number,
    Y?: number,
    Z?: number,
    F?: number,
    E?: number,
}

interface ScaraPos {
    a1: number,
    a2: number,
    Z: number,
    E: number,
}

export class ScaraConverter {
    x_offset: number;
    y_offset: number;
    skew: number;
    feed_rate: number;
    right_handed: boolean;
    L1: number;
    L2: number;
    a1_driver_teeth: number;
    a1_receiver_teeth: number;
    a1_steps_per_rev: number;
    a2_driver_teeth: number;
    a2_receiver_teeth: number;
    a2_steps_per_rev: number;
    max_seg_length: number;
    constructor() {
        this.x_offset = 80;
        this.y_offset = 80;
        this.skew =  0;
        this.feed_rate = 1000;
        this.right_handed=  true;
        this.L1 = 100;
        this.L2 = 80;
        this.a1_driver_teeth = 20;
        this.a1_receiver_teeth = 36;
        this.a1_steps_per_rev = 200;
        this.a2_driver_teeth = 20;
        this.a2_receiver_teeth = 36;
        this.a2_steps_per_rev = 200;
        this. max_seg_length = 0.5;

    }
    parse_gcode_move(gcode_cmd: string[]): EffectorPos {
        console.log(gcode_cmd)
        let move_pos: EffectorPos = {X: undefined, Y: undefined, Z: undefined, F: undefined, E: undefined};
        for (const gcode_seg_index in gcode_cmd) {
            const gcode_seg = gcode_cmd[gcode_seg_index];
            if(gcode_seg[0] === "X") {
                move_pos.X = parseFloat(gcode_seg.replace("X", ""))
            }
            if(gcode_seg[0] === "Y") {
                move_pos.Y = parseFloat(gcode_seg.replace("Y", ""))
            }
            if(gcode_seg[0] === "Z") {
                move_pos.Z = parseFloat(gcode_seg.replace("Z", ""))
            }
            if(gcode_seg[0] === "E") {
                move_pos.E = parseFloat(gcode_seg.replace("E", ""))
            }
            if(gcode_seg[0] === "F") {
                move_pos.F = parseFloat(gcode_seg.replace("F", ""))
            }
        }
        return move_pos;
    };
    scara_distance(start: ScaraPos, end: ScaraPos): number {
        return Math.sqrt((end.a1-start.a1)**2+(end.a2-start.a2)**2+(end.Z-start.Z)**2);
    };
    map_cartesian_to_scara(next_pos: EffectorPos, right_handed: boolean = true): ScaraPos {
        const R = Math.hypot(next_pos.X!, next_pos.Y!);
        const gamma = Math.atan2(next_pos.Y!, next_pos.X!)
        const beta = Math.acos((R**2-(this.L1**2)-(this.L2**2))/(-2*this.L1*this.L2))
        const psi = Math.PI-beta
        const alpha = Math.asin((this.L2*Math.sin(psi))/R)

        const scara_pos: ScaraPos = {a1: 0, a2: 0, Z: 0, E: 0} 
        if (right_handed) {
            scara_pos.a1 = (gamma-alpha) * 180 / Math.PI;
            scara_pos.a2 = psi * 180 / Math.PI;
        } 
        else {
            scara_pos.a1 = (gamma+alpha) * 180 / Math.PI;
            scara_pos.a2 = (beta - Math.PI) * 180 / Math.PI;
        }            
        scara_pos.a1 = parseFloat(scara_pos.a1.toPrecision(4));
        scara_pos.a2 = parseFloat(scara_pos.a2.toPrecision(4));
        scara_pos.Z = next_pos.Z!;
        scara_pos.E = next_pos.E!;
        return scara_pos;
    };
    interpolate(start: EffectorPos, end: EffectorPos, i: number, n: number): EffectorPos {
        return {
            X: (i*end.X! + (n - i) * start.X!) / n,
            Y: (i*end.Y! + (n - i) * start.Y!) / n,
            Z: (i*end.Z! + (n - i) * start.Z!) / n,
            E: (i*end.E! + (n - i) * start.E!) / n,
            F: this.feed_rate,
        }
    };
    segmentize_cartesian_to_scara(start: EffectorPos, end: EffectorPos): ScaraPos[] {
        console.log(this.map_cartesian_to_scara(start), this.map_cartesian_to_scara(end));
        const l = this.scara_distance(this.map_cartesian_to_scara(start), this.map_cartesian_to_scara(end))
        if (l <= this.max_seg_length) {
            return [this.map_cartesian_to_scara(end)]; 
        } else {
            let n = Math.round(Math.ceil( l / this.max_seg_length))
            console.log(n);
            return Array(n).fill(0).map((_: any, i: number) => {
                return this.map_cartesian_to_scara(this.interpolate(start, end, i+1, n))
            });
        }
    };
    translate(pos: EffectorPos): EffectorPos {
        let newPos = {...pos};
        const hyp = Math.hypot(pos.X!, pos.Y!);
        const hypAngle = Math.atan2(pos.Y!, pos.X!);
        const newHypAngle = hypAngle+ this.skew;
        newPos.X = (Math.cos(newHypAngle)*hyp) + this.x_offset;
        newPos.Y= (Math.sin(newHypAngle)*hyp) + this.y_offset;
        return newPos;
    };
    plot_scara_move(next_cmd: string, current_pos: EffectorPos): [string[], EffectorPos] {
        let cmd_list = [] as string[];
        if (next_cmd[0]==';' || next_cmd[0] == '(' || next_cmd[0]=='\n'){
            return [[next_cmd.trim()], current_pos]; // Clean pure comment lines
        } else {
            let next_pos_clean = next_cmd.trim() // Clean whitespace
            next_pos_clean = next_pos_clean.split(';')[0].trim() // Split line into list and remove comments
            next_pos_clean = next_pos_clean.replace(/^N\d+ /gm, ""); // Remove line numbers
            const next_pos_segs = next_pos_clean.split('(P')[0].split(" ")
            if (next_pos_segs[0] == 'G1' || next_pos_segs[0] == 'G01' || next_pos_segs[0] == 'G0' || next_pos_segs[0] == 'G00') {
                let rapid = false;
                if (next_pos_segs[0] == 'G0' || next_pos_segs[0] == 'G00') {
                    rapid = true;
                }
                let next_pos = this.parse_gcode_move(next_pos_segs);
                if (isNaN(next_pos.X!)) next_pos.X = current_pos.X;
                if (isNaN(next_pos.Y!)) next_pos.Y = current_pos.Y;
                if (isNaN(next_pos.Z!)) next_pos.Z = current_pos.Z;
                if (isNaN(next_pos.E!)) next_pos.E = current_pos.E;
                if (isNaN(next_pos.F!)) next_pos.F = current_pos.F;

                if (next_pos.X === current_pos.X && next_pos.Y === current_pos.Y && next_pos.Z === current_pos.Z) {
                    //cmd_list.push(`G1 F${this.feed_rate} (retract)`)
                    return [cmd_list, next_pos];
                } else {
                    if (rapid) {
                        const scara_pos = this.map_cartesian_to_scara(this.translate(next_pos));
                        cmd_list.push(`G1 X${scara_pos.a1} Y${scara_pos.a2} Z${scara_pos.Z} F${this.feed_rate} (rapid move)`)
                        return [cmd_list, next_pos]; 
                    } else {
                        const scara_pos_segs = this.segmentize_cartesian_to_scara(this.translate(current_pos), this.translate(next_pos))
                        cmd_list = cmd_list.concat(scara_pos_segs.map((scara_pos) => {
                            return `G1 X${scara_pos.a1} Y${scara_pos.a2} Z${scara_pos.Z} F${this.feed_rate} (seg move)`
                        }));
                        return [cmd_list, next_pos];
                    } 
                }
            } else if(next_pos_segs[0] == 'G92.1') {
                return [[], {X: 0, Y: 0, Z: 0, E: 0, F: this.feed_rate}]
            }
            return [[`(unable to parse line: ${next_cmd})`], current_pos]
        }
        /*
        elif Gline[0] == 'G92':
            prevWorkingPos[3] = 0
            currentPos[3] = 0
            for i in range(len(Gline)): #pass everything else straight to output file
                fo.write(Gline[i])
                fo.write(' ')
            fo.write(" ;reset e\n")  #need to finish writing for other axis
            

        else:
            for i in range(len(Gline)): #pass everything else straight to output file
                fo.write(Gline[i])
                fo.write(' ')

            }
        */
    };
    convert_cartesian_to_scara(gcode_string: string): string {
        let gcode_lines = gcode_string.split("\n");
        let current_pos: EffectorPos = {X: undefined, Y: undefined, Z: undefined, F: this.feed_rate};
        let converted_gcode = gcode_lines.reduce((agg: string[], next_cmd: string) => {
            let cmd_list: string[] = [];
            console.log("Current:", current_pos);
            [cmd_list, current_pos] = this.plot_scara_move(next_cmd, current_pos);
            return agg.concat(cmd_list);
        }, []);//[`$0 = ${ (this.a1_steps_per_rev/360) * (this.a1_receiver_teeth/this.a1_driver_teeth) }`, `$1 = ${ (this.a2_steps_per_rev/360) * (this.a2_receiver_teeth/this.a2_driver_teeth) }`] as string[])
        console.log(converted_gcode);
        return converted_gcode.join("\n");
    };
}