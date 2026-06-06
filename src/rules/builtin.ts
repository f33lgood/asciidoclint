import type { LintFinding, Rule } from "../types.js";
import { AD001 } from "./AD001.js";
import { AD002 } from "./AD002.js";
import { AD003 } from "./AD003.js";
import { AD004 } from "./AD004.js";
import { AD005 } from "./AD005.js";
import { AD006 } from "./AD006.js";
import { AD007 } from "./AD007.js";
import { AD008 } from "./AD008.js";
import { AD009 } from "./AD009.js";
import { AD010 } from "./AD010.js";
import { AD011 } from "./AD011.js";
import { AD012 } from "./AD012.js";
import { AD013 } from "./AD013.js";
import { AD016 } from "./AD016.js";
import { AD017 } from "./AD017.js";
import { AD019 } from "./AD019.js";
import { AD020 } from "./AD020.js";
import { AD022 } from "./AD022.js";
import { AD023 } from "./AD023.js";
import { AD032 } from "./AD032.js";
import { AD034 } from "./AD034.js";
import { AD035 } from "./AD035.js";
import { AD036 } from "./AD036.js";
import { AD037 } from "./AD037.js";
import { AD039 } from "./AD039.js";
import { AD040 } from "./AD040.js";
import { AD041 } from "./AD041.js";
import { AD042 } from "./AD042.js";
import { AD043 } from "./AD043.js";
import { AD044 } from "./AD044.js";
import { AD045 } from "./AD045.js";
import { AD046 } from "./AD046.js";
import { AD047 } from "./AD047.js";
import { AD048 } from "./AD048.js";
import { AD049 } from "./AD049.js";
import { AD050 } from "./AD050.js";
import { AD051 } from "./AD051.js";
import { AD052 } from "./AD052.js";
import { AD053 } from "./AD053.js";
import { AD054 } from "./AD054.js";
import { AD055 } from "./AD055.js";
import { AD056 } from "./AD056.js";
import { AD057 } from "./AD057.js";
import { AD058 } from "./AD058.js";
import { AD059 } from "./AD059.js";
import { ADW01 } from "./ADW01.js";
import { ADW02 } from "./ADW02.js";
import { ADW03 } from "./ADW03.js";
import { ADW04 } from "./ADW04.js";
import { ADW05 } from "./ADW05.js";
import { ADW06 } from "./ADW06.js";
import { ADW07 } from "./ADW07.js";
import { ADW08 } from "./ADW08.js";
import { AD024 } from "./AD024.js";
import { AD025 } from "./AD025.js";
import { AD026 } from "./AD026.js";
import { AD027 } from "./AD027.js";
import { AD028 } from "./AD028.js";
import { AD029 } from "./AD029.js";
import { AD030 } from "./AD030.js";
import { AD031 } from "./AD031.js";

export const builtInRules: Rule[] = [
  AD001,
  AD002,
  AD003,
  AD004,
  AD005,
  AD006,
  AD007,
  AD008,
  AD009,
  AD010,
  AD011,
  AD012,
  AD013,
  AD016,
  AD017,
  AD019,
  AD020,
  AD022,
  AD023,
  AD024,
  AD025,
  AD026,
  AD027,
  AD028,
  AD029,
  AD030,
  AD031,
  AD032,
  AD034,
  AD035,
  AD036,
  AD037,
  AD039,
  AD040,
  AD041,
  AD042,
  AD043,
  AD044,
  AD045,
  AD046,
  AD047,
  AD048,
  AD049,
  AD050,
  AD051,
  AD052,
  AD053,
  AD054,
  AD055,
  AD056,
  AD057,
  AD058,
  AD059,
  ADW01,
  ADW02,
  ADW03,
  ADW04,
  ADW05,
  ADW06,
  ADW07,
  ADW08,
];

export function ruleLabel(finding: Pick<LintFinding, "ruleId" | "alias">): string {
  return finding.alias ? `${finding.ruleId}/${finding.alias}` : finding.ruleId;
}
