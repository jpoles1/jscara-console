const gcodeParser = require('gcode-parser');
export interface EffectorPos {
    X?: number,
    Y?: number,
    Z?: number,
    F?: number,
    E?: number,
}

export interface ScaraPos {
    a1: number,
    a2: number,
    Z: number,
    E: number,
}

export interface ScaraProps {
    L1: number;
    L2: number;
    a1_driver_teeth: number;
    a1_receiver_teeth: number;
    a1_steps_per_rev: number;
    a2_driver_teeth: number;
    a2_receiver_teeth: number;
    a2_secondary_receiver_teeth: number;
    a2_steps_per_rev: number;
    max_speed: number;
}

export const scara_default_props: ScaraProps = {
    L1: 120,
    L2: 120,
    a1_driver_teeth: 20,
    a1_receiver_teeth: 80,
    a1_steps_per_rev: 800,
    a2_driver_teeth: 20,
    a2_receiver_teeth: 80,
    a2_secondary_receiver_teeth: 80,
    a2_steps_per_rev: 800,
    max_speed: 4000,
}  

export class ScaraConverter {
    x_offset: number;
    y_offset: number;
    inner_rad: number;
    skew: number;
    feed_rate: number;
    right_handed: boolean;
    max_seg_length: number;
    scara_props: ScaraProps;
    constructor() {
        this.x_offset = 0;
        this.y_offset = 0;
        this.inner_rad = 40;
        this.skew =  0;
        this.feed_rate = 2000;
        this.right_handed = false;
        this.max_seg_length = .5;
        this.scara_props = scara_default_props;
    }
    parse_gcode_move(gcode_cmd: any[][]): EffectorPos {
        let move_pos: EffectorPos = {X: undefined, Y: undefined, Z: undefined, F: undefined, E: undefined};
        for (const gcode_seg_index in gcode_cmd) {
            const gcode_seg = gcode_cmd[gcode_seg_index];
            if(gcode_seg[0] === "X") {
                move_pos.X = gcode_seg[1]
            }
            if(gcode_seg[0] === "Y") {
                move_pos.Y = gcode_seg[1]
            }
            if(gcode_seg[0] === "Z") {
                move_pos.Z = gcode_seg[1]
            }
            if(gcode_seg[0] === "E") {
                move_pos.E = gcode_seg[1]
            }
            if(gcode_seg[0] === "F") {
                move_pos.F = gcode_seg[1]
            }
        }
        return move_pos;
    };
    scara_distance(start: ScaraPos, end: ScaraPos): number {
        return Math.sqrt((end.a1-start.a1)**2+(end.a2-start.a2)**2+(end.Z-start.Z)**2);
    };
    map_cartesian_to_scara(next_pos: EffectorPos): ScaraPos {
        const R = Math.hypot(next_pos.X!, next_pos.Y!);
        const gamma = Math.atan2(next_pos.Y!, next_pos.X!)
        const handedness = this.right_handed ? -1 : 1
        const scara_pos: ScaraPos = {a1: 0, a2: 0, Z: 0, E: 0} 
        scara_pos.a1 = (gamma + handedness * Math.acos((R**2 + (this.scara_props.L1**2)-(this.scara_props.L2**2))/(2*this.scara_props.L1*R))) * 180 / Math.PI
        scara_pos.a2 = (gamma - handedness * Math.acos((R**2 + (this.scara_props.L2**2)-(this.scara_props.L1**2))/(2*this.scara_props.L2*R))) * 180 / Math.PI
        if (isNaN(scara_pos.a1) || isNaN(scara_pos.a2)) {
            console.log("ERROR: Conversion failed: GCODE results in NaNs!", next_pos, scara_pos);
            if (alert) {
                alert("ERROR: Conversion failed: GCODE results in NaNs!");
            }
            throw "ERROR: Conversion failed: GCODE results in NaNs!";
        }
        else if(scara_pos.a1 > 180 || scara_pos.a1 < 0 || scara_pos.a2 > 140 || scara_pos.a2 < -140) {
            console.log("ERROR: Conversion failed: GCODE falls outside useable work area!", next_pos, scara_pos);
            if (alert) {
                alert("ERROR: Conversion failed: GCODE falls outside useable work area!");
            }
            throw "ERROR: Conversion failed: GCODE falls outside useable work area!";
        }
        // Round values
        scara_pos.a1 = parseFloat(scara_pos.a1.toFixed(2));
        scara_pos.a2 = parseFloat(scara_pos.a2.toFixed(2));
        scara_pos.Z = next_pos.Z!;
        scara_pos.E = next_pos.E!;
        return scara_pos;
    };
    cartesian_to_scara_feedrate(current_pos: EffectorPos, next_pos: EffectorPos, cartesian_feedrate: number) {
        const a = this.scara_props.L1;
        const b = this.scara_props.L2;
        const handedness = this.right_handed ? -1 : 1
        const travel_dist = Math.sqrt((next_pos.X!-current_pos.X!)**2+(next_pos.Y!-current_pos.Y!)**2);
        if(travel_dist === 0) return 0;
        const x_dot = (next_pos.X!-current_pos.X!)/travel_dist*cartesian_feedrate // Linear velocity in the x direction
        const y_dot = (next_pos.Y!-current_pos.Y!)/travel_dist*cartesian_feedrate // Linear velocity in the y direction
        const c = Math.sqrt(current_pos.X!**2+current_pos.Y!**2) // Length of vector C (From shoulder to coord 1)
        const c_dot = (current_pos.X!*x_dot+current_pos.Y!*y_dot)/Math.sqrt(current_pos.X!**2+current_pos.Y!**2) // Rate of change of the length of vector c
        const omega_c = (current_pos.X!*y_dot-current_pos.Y!*x_dot)/c**2 // Angular rate of change of vector c
        const omega_a = (omega_c - handedness*c_dot*(2*c**2*a-c**2-a**2+b**2)/(2*c**2*a**2) * Math.sqrt(1-(c**2+a**2-b**2)/(2*c*a))) // Angular rate of change of the upper arm
        const omega_b = (omega_c + handedness*c_dot*(2*c**2*b-c**2-b**2+a**2)/(2*c**2*b**2) * Math.sqrt(1-(c**2+b**2-a**2)/(2*c*b))) // Angular rate of change of the forearm
        const omega = Math.sqrt(omega_a**2+omega_b**2) // Sum the squares of the angular feedrates.
        return parseFloat(Math.min(Math.abs(Math.round(omega) * 180 / Math.PI), this.scara_props.max_speed).toFixed(1));
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
        const l = this.scara_distance(this.map_cartesian_to_scara(start), this.map_cartesian_to_scara(end))
        if (l <= this.max_seg_length) {
            return [this.map_cartesian_to_scara(end)]; 
        } else {
            let n = Math.round(Math.ceil( l / this.max_seg_length))
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
        newPos.X = pos.X! + this.x_offset;
        newPos.Y= pos.Y! + this.y_offset;
        return newPos;
    };
    plot_scara_move(next_cmd_str: string, current_pos: EffectorPos): [string[], EffectorPos] {
        let cmd_list = [] as string[];
        let next_cmd = gcodeParser.parseLine(next_cmd_str);
        if (next_cmd.words.length === 0){
            return [[], current_pos]; // Clean pure comment lines
        } else {
            if ((next_cmd.words[0][0] === "G" && [0, 1].includes(next_cmd.words[0][1])) || !["G", "M"].includes(next_cmd.words[0][0])) {
                let rapid = false;
                if (next_cmd.words[0][0] === "G" && next_cmd.words[0][1] === 0) {
                    rapid = true;
                }
                let next_pos = this.parse_gcode_move(next_cmd.words);
                next_pos.Y = next_pos.Y! + this.inner_rad;
                if (isNaN(next_pos.X!)) next_pos.X = current_pos.X;
                if (isNaN(next_pos.Y!)) next_pos.Y = current_pos.Y;
                if (isNaN(next_pos.Z!)) next_pos.Z = current_pos.Z;
                if (isNaN(next_pos.E!)) next_pos.E = current_pos.E;
                if (isNaN(next_pos.F!)) next_pos.F = current_pos.F;
                // First command
                if (next_pos.X === current_pos.X && next_pos.Y === current_pos.Y) {
                    if (next_pos.Z !== current_pos.Z) {
                        cmd_list.push(`G1 Z${next_pos.Z} F${this.feed_rate}`)
                    }
                    return [cmd_list, next_pos]; 
                }
                if ((current_pos.X === undefined && current_pos.Y === undefined) || rapid){
                    const scara_pos = this.map_cartesian_to_scara(this.translate(next_pos));
                    cmd_list.push(`G0 X${scara_pos.a1} Y${scara_pos.a2} Z${scara_pos.Z} F${this.feed_rate}`)
                    return [cmd_list, next_pos]; 
                }
                else {
                    let travel_dist = Math.sqrt((next_pos.X!-current_pos.X!)**2+(next_pos.Y!-current_pos.Y!)**2)
                    let mid_pos: EffectorPos = {
                        X: current_pos.X,
                        Y: current_pos.Y,
                        Z: current_pos.Z,
                    }
                    while (travel_dist > this.max_seg_length) {
                        mid_pos = {
                            X: mid_pos.X! + (next_pos.X! - mid_pos.X!)*this.max_seg_length/travel_dist,
                            Y: mid_pos.Y! + (next_pos.Y! - mid_pos.Y!)*this.max_seg_length/travel_dist,
                            Z: mid_pos.Z! + (next_pos.Z! - mid_pos.Z!)*this.max_seg_length/travel_dist,
                        }
                        //const scara_pos = this.map_cartesian_to_scara(this.translate(mid_pos));
                        const scara_pos = this.map_cartesian_to_scara(this.translate(mid_pos));
                        const scara_feedrate = this.cartesian_to_scara_feedrate(mid_pos, next_pos, this.feed_rate)
                        cmd_list.push(`G1 X${scara_pos.a1} Y${scara_pos.a2} Z${scara_pos.Z} F${scara_feedrate}`)
                        travel_dist = Math.sqrt((next_pos.X!-mid_pos.X!)**2+(next_pos.Y!-mid_pos.Y!)**2)
                    }
                    const final_scara_pos = this.map_cartesian_to_scara(this.translate(mid_pos));
                    const scara_feedrate = this.cartesian_to_scara_feedrate(mid_pos, next_pos, this.feed_rate)
                    cmd_list.push(`G1 X${final_scara_pos.a1} Y${final_scara_pos.a2} Z${final_scara_pos.Z} F${scara_feedrate}`)
                    return [cmd_list, next_pos];
                }
            } else if(next_cmd.words[0][0] === "G" && next_cmd.words[0][1] === 92.1) {
                return [[], {X: 0, Y: 0, Z: 0, E: 0, F: this.feed_rate}]
            }
            return [[`(unable to parse line: ${next_cmd_str})`], current_pos]
        }
    };
    convert_cartesian_to_scara(gcode_string: string): string {
        gcode_string = gcode_string.replace(/[N]\d+(?= [^G])/g, "G1");
        gcode_string = gcode_string.replace(/[N]\d+ /g, "");
        let gcode_lines = gcode_string.split("\n");
        let current_pos: EffectorPos = {X: undefined, Y: undefined, Z: 0, F: this.feed_rate};
        // GRBL 0.8c compatible GCODES for setting steps such that each full step is the equivalent of 1 degree!
        let init_gcode =  [
            `M92 X${ (this.scara_props.a1_steps_per_rev/360) * (this.scara_props.a1_receiver_teeth/this.scara_props.a1_driver_teeth) }`, 
            `M92 Y${ (this.scara_props.a2_steps_per_rev/360) * (this.scara_props.a2_receiver_teeth/this.scara_props.a2_driver_teeth) * (this.scara_props.a2_secondary_receiver_teeth/this.scara_props.a2_receiver_teeth) }`
        ];
        let converted_gcode = gcode_lines.reduce((agg: string[], next_cmd: string) => {
            let cmd_list: string[] = [];
            [cmd_list, current_pos] = this.plot_scara_move(next_cmd, current_pos);
            return agg.concat(cmd_list);
        }, []);
        return converted_gcode.join("\n");
    };
}