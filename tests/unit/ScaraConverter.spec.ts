import {ScaraConverter} from "@/ScaraConverter";

describe("HelloWorld.vue", () => {
  it("Converts Properly", () => {
    const scara = new ScaraConverter();
    let output = scara.convert_cartesian_to_scara("G0 X0 Y20");
    console.log(output);
  });
});
