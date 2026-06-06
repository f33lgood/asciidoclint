import type { Rule } from "../types.js";

export const AD025: Rule = {
  id: "AD025",
  alias: "missing-image",
  description: "Image targets should exist after attribute substitution",
  tags: ["dependencies", "image"],
  parser: "dependency",
  docs: {
    summary: "image:: targets should resolve to an existing file.",
    rationale: "Asciidoctor can emit HTML that points at a missing image path, but publishable output is incomplete and PDF/data-uri style conversions need the asset at conversion time.",
    fixability: "no",
    fixHelper: "Create the image file, fix the image target or imagesdir value, or use a URL target when the image is intentionally remote.",
    badExamples: [{ code: "image::missing.png[]" }],
    goodExamples: [
      { code: "image::diagram.png[Overview diagram]" },
      { code: ":imagesdir: images\nimage::diagram.png[Overview diagram]" },
      { code: "See image:icon.svg[Status icon]." },
      { code: "image::https://example.com/diagram.png[Remote diagram]" },
    ],
  },
  function: ({ dependencies }, onError) => {
    for (const record of dependencies.records) {
      if (record.type === "image" && record.status === "missing") {
        onError({
          severity: "error",
          message: `Missing image target: ${record.target}`,
          range: record.range,
          fixHelper: "Create the image file, fix the image target or imagesdir value, or use a URL target when the image is intentionally remote.",
        });
      }
    }
  },
};
