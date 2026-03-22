import { describe, expect, it } from "vitest";
import { getPhase1ToolPolicy } from "../src/runtime/tool-policy.js";

describe("getPhase1ToolPolicy", () => {
  it("uses the Phase 1 default tool set", () => {
    expect(getPhase1ToolPolicy()).toEqual({
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      tools: ["Bash", "Read", "Write", "Edit"]
    });
  });

  it("allows the config to override the tool allowlist", () => {
    expect(
      getPhase1ToolPolicy({
        tools: {
          availableTools: ["Read", "Bash"]
        }
      })
    ).toEqual({
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      tools: ["Read", "Bash"]
    });
  });

  it("returns a copy of the allowlist", () => {
    const policy = getPhase1ToolPolicy({
      tools: {
        availableTools: ["Read"]
      }
    });

    policy.tools.push("Write");

    expect(
      getPhase1ToolPolicy({
        tools: {
          availableTools: ["Read"]
        }
      }).tools
    ).toEqual(["Read"]);
  });
});
