"use strict"

import { parseAddressParam } from "../src/js/utils"

test("Parse address param", () => {
    expect(parseAddressParam("?foo=3&bar=abc")).toEqual(
        { "foo": "3", "bar": "abc" }
    )
})