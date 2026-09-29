/* eslint-disable quotes */
import { expect, test } from "vitest";

import { stripAllTags } from "./utils";

test("test the stripTags function", () => {
    const input =
        '<blockgroup><blockcontainer backgroundColor="default" id="initialBlockId" textColor="default"><paragraph textAlignment="left">This is a test document</paragraph></blockcontainer><blockcontainer backgroundColor="default" id="4677885d-fd10-45da-86dc-3cbb1799a484" textColor="default"><paragraph textAlignment="left"></paragraph></blockcontainer></blockgroup>';
    const output = "This is a test document";
    expect(stripAllTags(input)).toBe(output);
});

test("test stripTags for two paragraph", () => {
    const input =
        '<blockgroup><blockcontainer backgroundColor="default" id="initialBlockId" textColor="default"><paragraph textAlignment="left">This is the first line</paragraph></blockcontainer><blockcontainer backgroundColor="default" id="4677885d-fd10-45da-86dc-3cbb1799a484" textColor="default"><paragraph textAlignment="left">This is the second line</paragraph></blockcontainer><blockcontainer backgroundColor="default" id="babbaf05-9723-4453-9cdc-6781f2614e7b" textColor="default"><paragraph textAlignment="left"></paragraph></blockcontainer></blockgroup>';
    const output = "This is the first line\nThis is the second line";
    expect(stripAllTags(input)).toBe(output);
});
test("test stripTags for three paragraph with some editions", () => {
    const input =
        '<blockgroup><blockcontainer backgroundColor="default" id="initialBlockId" textColor="default"><paragraph textAlignment="left">This is the first line</paragraph></blockcontainer><blockcontainer backgroundColor="default" id="4677885d-fd10-45da-86dc-3cbb1799a484" textColor="default"><paragraph textAlignment="left">This is the second line</paragraph></blockcontainer><blockcontainer backgroundColor="default" id="babbaf05-9723-4453-9cdc-6781f2614e7b" textColor="default"><paragraph textAlignment="left"></paragraph></blockcontainer><blockcontainer backgroundColor="default" id="01dd2f65-4553-461a-a26e-79dbb2ebaafe" textColor="default"><paragraph textAlignment="left"></paragraph></blockcontainer><blockcontainer backgroundColor="default" id="cf5f2dff-49b9-4025-9ec5-bb7fba60f150" textColor="default"><heading level="1" textAlignment="left">This is the third line</heading></blockcontainer><blockcontainer backgroundColor="default" id="2b946331-e464-41a6-bfc4-eb2235d2453a" textColor="default"><paragraph textAlignment="left"></paragraph></blockcontainer><blockcontainer backgroundColor="default" id="b1e0ce5e-e664-4ec3-b9d1-cdcf1a038468" textColor="default"><paragraph textAlignment="left"></paragraph></blockcontainer></blockgroup>';
    const output =
        "This is the first line\nThis is the second line\nThis is the third line";
    expect(stripAllTags(input)).toBe(output);
});
