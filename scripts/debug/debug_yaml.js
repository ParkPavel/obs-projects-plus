// Test case 1: null value
console.log('Test 1 - null value:');
const test1 = { status: null };
console.log('Input:', test1);
console.log('Keys:', Object.keys(test1));
console.log('Values:', Object.values(test1));
console.log('Entries:', Object.entries(test1));
console.log('JSON.stringify:', JSON.stringify(test1));
console.log('---');

// Test case 2: mixed values with undefined and null
console.log('Test 2 - mixed values:');
const test2 = { 
  foo: "5", 
  bar: undefined, 
  baz: null, 
  test: 4 
};
console.log('Input:', test2);
console.log('Keys:', Object.keys(test2));
console.log('Values:', Object.values(test2));
console.log('Entries:', Object.entries(test2));
console.log('JSON.stringify:', JSON.stringify(test2));
console.log('---');

// Test case 3: object with only null
console.log('Test 3 - only null:');
const test3 = { status: null };
console.log('Input:', test3);
console.log('JSON.stringify:', JSON.stringify(test3));
console.log('---');