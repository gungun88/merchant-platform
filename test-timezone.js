// 测试时区问题
const testDate = new Date('2025-11-27T03:04:00+08:00');
const now = new Date();

console.log('=== 时区测试 ===');
console.log('测试日期对象:', testDate);
console.log('测试日期 toString:', testDate.toString());
console.log('测试日期 toISOString:', testDate.toISOString());
console.log('测试日期时间戳:', testDate.getTime());
console.log('');
console.log('当前时间:', now);
console.log('当前时间 toString:', now.toString());
console.log('当前时间 toISOString:', now.toISOString());
console.log('当前时间时间戳:', now.getTime());
console.log('');
console.log('时间差(ms):', testDate.getTime() - now.getTime());
console.log('时间差(秒):', (testDate.getTime() - now.getTime()) / 1000);
console.log('时间差(分钟):', (testDate.getTime() - now.getTime()) / 60000);
console.log('');
console.log('系统时区偏移(分钟):', now.getTimezoneOffset());
console.log('环境变量 TZ:', process.env.TZ || '(未设置)');
