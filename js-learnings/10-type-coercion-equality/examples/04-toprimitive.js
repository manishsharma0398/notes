// Example 4: ToPrimitive and valueOf/toString
// Demonstrates: How objects convert to primitives

console.log('=== ToPrimitive ALGORITHM ===\n');

console.log('ToPrimitive(obj, hint):');
console.log('  hint "string" → toString() → valueOf()');
console.log('  hint "number" → valueOf() → toString()');
console.log('  hint "default" → valueOf() → toString() (usually)');

console.log('\n=== BASIC valueOf AND toString ===\n');

const basicObj = {
    valueOf() {
        console.log('  valueOf() called');
        return 42;
    },
    toString() {
        console.log('  toString() called');
        return "hello";
    }
};

console.log('Number(basicObj):');
const num1 = Number(basicObj);
console.log('  Result:', num1);

console.log('\nString(basicObj):');
const str1 = String(basicObj);
console.log('  Result:', str1);

console.log('\nbasicObj + 0 (hint: default):');
const result1 = basicObj + 0;
console.log('  Result:', result1);

console.log('\nbasicObj + "" (hint: default):');
const result2 = basicObj + "";
console.log('  Result:', result2);

console.log('\n=== ONLY toString DEFINED ===\n');

const onlyToString = {
    toString() {
        console.log('  toString() called');
        return "100";
    }
};

console.log('Number(onlyToString):');
const num2 = Number(onlyToString);
console.log('  Result:', num2, '(toString → "100" → 100)');

console.log('\nonlyToString + 0:');
const result3 = onlyToString + 0;
console.log('  Result:', result3);

console.log('\n=== ONLY valueOf DEFINED ===\n');

const onlyValueOf = {
    valueOf() {
        console.log('  valueOf() called');
        return 99;
    }
};

console.log('String(onlyValueOf):');
const str2 = String(onlyValueOf);
console.log('  Result:', str2, '(valueOf → 99 → "99")');

console.log('\nonlyValueOf - 1:');
const result4 = onlyValueOf - 1;
console.log('  Result:', result4);

console.log('\n=== Symbol.toPrimitive ===\n');

const customConversion = {
    [Symbol.toPrimitive](hint) {
        console.log(`  [Symbol.toPrimitive](${hint}) called`);

        if (hint === 'number') {
            return 42;
        }
        if (hint === 'string') {
            return 'hello';
        }
        // hint === 'default'
        return 'default value';
    },

    // These are ignored when Symbol.toPrimitive is present
    valueOf() {
        console.log('  valueOf() called (should not be called)');
        return 999;
    },
    toString() {
        console.log('  toString() called (should not be called)');
        return "ignored";
    }
};

console.log('Number(customConversion):');
console.log('  Result:', Number(customConversion));

console.log('\nString(customConversion):');
console.log('  Result:', String(customConversion));

console.log('\ncustomConversion + " world":');
console.log('  Result:', customConversion + " world");

console.log('\ncustomConversion + 10:');
console.log('  Result:', customConversion + 10);

console.log('\n=== RETURNING NON-PRIMITIVE ===\n');

const invalidConversion = {
    valueOf() {
        console.log('  valueOf() returns object');
        return {};  // Not primitive!
    },
    toString() {
        console.log('  toString() returns object');
        return {};  // Not primitive!
    }
};

console.log('Number(invalidConversion):');
try {
    Number(invalidConversion);
} catch (e) {
    console.log('  ERROR:', e.message);
}

console.log('\n=== ARRAY CONVERSION ===\n');

console.log('Array.prototype.toString joins with commas:');
console.log('  [1, 2, 3].toString():', [1, 2, 3].toString());
console.log('  [].toString():', [].toString(), '(empty)');
console.log('  [[1], [2]].toString():', [[1], [2]].toString());

console.log('\nArray.prototype.valueOf returns array itself:');
const arr = [1, 2, 3];
console.log('  arr.valueOf() === arr:', arr.valueOf() === arr);

console.log('\nConversion process:');
console.log('  Number([]):', Number([]), '([] → "" → 0)');
console.log('  Number([5]):', Number([5]), '([5] → "5" → 5)');
console.log('  Number([1, 2]):', Number([1, 2]), '([1,2] → "1,2" → NaN)');

console.log('\n=== DATE CONVERSION ===\n');

const date = new Date('2024-01-01T00:00:00Z');

console.log('Date has special toString:');
console.log('  date.toString():', date.toString());
console.log('  String(date):', String(date));

console.log('\nDate valueOf returns timestamp:');
console.log('  date.valueOf():', date.valueOf());
console.log('  Number(date):', Number(date));

console.log('\nDate uses toString for default hint:');
console.log('  date + "":', date + "");

console.log('\n=== PRACTICAL EXAMPLES ===\n');

console.log('--- Example 1: Counter Object ---');
class Counter {
    constructor(value = 0) {
        this.value = value;
    }

    valueOf() {
        return this.value;
    }

    toString() {
        return `Counter(${this.value})`;
    }
}

const counter = new Counter(5);
console.log('counter + 10:', counter + 10, '(uses valueOf)');
console.log('String(counter):', String(counter), '(uses toString)');
console.log('counter > 3:', counter > 3);

console.log('\n--- Example 2: Price Object ---');
class Price {
    constructor(cents) {
        this.cents = cents;
    }

    valueOf() {
        return this.cents;
    }

    toString() {
        return `$${(this.cents / 100).toFixed(2)}`;
    }
}

const price1 = new Price(1250);  // $12.50
const price2 = new Price(375);   // $3.75

console.log('price1 + price2:', price1 + price2, '(cents)');
console.log('String(price1):', String(price1));
console.log('price1 > price2:', price1 > price2);

console.log('\n--- Example 3: Controlled Conversion ---');
const sensitiveData = {
    password: 'secret123',

    [Symbol.to Primitive]() {
        throw new Error('Cannot convert sensitive data to primitive!');
    },

toString() {
    return '[SensitiveData]';
},

valueOf() {
    return NaN;
}
};

try {
    console.log('sensitiveData + "":', sensitiveData + "");
} catch (e) {
    console.log('  ERROR:', e.message);
}

console.log('\n=== COMMON PATTERNS ===\n');

console.log('--- Making objects number-like ---');
const point = {
    x: 10,
    y: 20,

    valueOf() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    },

    toString() {
        return `(${this.x}, ${this.y})`;
    }
};

console.log('Distance from origin:', +point, '(valueOf)');
console.log('String representation:', String(point), '(toString)');

console.log('\n--- Making objects string-like ---');
const url = {
    protocol: 'https',
    domain: 'example.com',
    path: '/api/users',

    toString() {
        return `${this.protocol}://${this.domain}${this.path}`;
    },

    valueOf() {
        return this.toString();
    }
};

console.log('URL:', String(url));
console.log('In template:', `Request to ${url}`);

console.log('\n=== GOTCHAS ===\n');

console.log('--- Order matters ---');
const orderTest = {
    valueOf() { return 'from valueOf'; },
    toString() { return 'from toString'; }
};

console.log('Number context (valueOf first):', Number(orderTest));
console.log('String context (toString first):', String(orderTest));
console.log('Default context (valueOf first):', orderTest + "");

console.log('\n--- Empty object/array ---');
console.log('{} + []:', ({}) + [], '(uses toString on both)');
console.log('[] + {}:', [] + {});
console.log('+{}:', +({}), '(NaN, "[object Object]" → NaN)');
console.log('+[]:', +[]);

console.log('\n--- Multiple conversions ---');
console.log('"" + {} + []:', "" + {} + []);
console.log('Breakdown: "" + {} = "[object Object]"');
console.log('          "[object Object]" + [] = "[object Object]"');

console.log('\n=== KEY TAKEAWAYS ===');
console.log('1. ToPrimitive(obj, hint) controls object-to-primitive conversion');
console.log('2. hint "number": valueOf() → toString()');
console.log('3. hint "string": toString() → valueOf()');
console.log('4. Symbol.toPrimitive overrides valueOf/toString');
console.log('5. If no primitive returned, TypeError');
console.log('6. Arrays join elements with toString()');
console.log('7. Dates have special toString behavior');
console.log('8. Useful for custom classes (Price, Counter, etc.)');
console.log('9. valueOf for numeric operations, toString for strings');
console.log('10. Default hint usually behaves like "number"');
