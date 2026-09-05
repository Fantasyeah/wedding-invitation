import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRsvp } from '../functions/_lib/validate.js';

test('必填：姓名为空时报错', () => {
  const r = validateRsvp({ attendance: 'attending', party_size: '2', needs_accommodation: 'no' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.guest_name);
});

test('必填：是否参加缺失时报错', () => {
  const r = validateRsvp({ guest_name: '张三' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.attendance);
});

test('参加：人数与住宿合法则通过', () => {
  const r = validateRsvp({ guest_name: '张三', attendance: 'attending', party_size: '3', needs_accommodation: 'no' });
  assert.equal(r.ok, true);
  assert.equal(r.value.party_size, 3);
  assert.equal(r.value.needs_accommodation, 'no');
});

test('参加：人数越界（7）报错', () => {
  const r = validateRsvp({ guest_name: '张三', attendance: 'attending', party_size: '7', needs_accommodation: 'no' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.party_size);
});

test('参加：人数为 0 报错', () => {
  const r = validateRsvp({ guest_name: '张三', attendance: 'attending', party_size: '0', needs_accommodation: 'no' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.party_size);
});

test('参加：住宿选项非法报错', () => {
  const r = validateRsvp({ guest_name: '张三', attendance: 'attending', party_size: '2', needs_accommodation: 'maybe' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.needs_accommodation);
});

test('无法参加：人数归 0、住宿为不需要（忽略传入值）', () => {
  const r = validateRsvp({ guest_name: '李四', attendance: 'declined', party_size: '5', needs_accommodation: 'yes', phone: '' });
  assert.equal(r.ok, true);
  assert.equal(r.value.party_size, 0);
  assert.equal(r.value.needs_accommodation, 'no');
});

test('需要住宿：电话必填', () => {
  const r = validateRsvp({ guest_name: '王五', attendance: 'attending', party_size: '2', needs_accommodation: 'yes', phone: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.phone);
});

test('需要住宿：填写电话后通过', () => {
  const r = validateRsvp({ guest_name: '王五', attendance: 'attending', party_size: '2', needs_accommodation: 'yes', phone: '13800000000' });
  assert.equal(r.ok, true);
});

test('留言超过 200 字报错', () => {
  const r = validateRsvp({ guest_name: '张三', attendance: 'declined', message: 'x'.repeat(201) });
  assert.equal(r.ok, false);
  assert.ok(r.errors.message);
});

test('姓名超过 40 字报错', () => {
  const r = validateRsvp({ guest_name: 'x'.repeat(41), attendance: 'declined' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.guest_name);
});

test('非法 attendance 值报错', () => {
  const r = validateRsvp({ guest_name: '张三', attendance: 'maybe' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.attendance);
});

test('姓名与留言会去除首尾空白', () => {
  const r = validateRsvp({ guest_name: '  张三  ', attendance: 'declined', message: '  祝福  ' });
  assert.equal(r.value.guest_name, '张三');
  assert.equal(r.value.message, '祝福');
});
