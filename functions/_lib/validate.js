// RSVP 表单字段校验与条件逻辑（纯函数，便于单元测试）。
// 服务端再次校验，不能只依赖前端。

export const LIMITS = {
  nameMax: 40,
  phoneMax: 30,
  messageMax: 200,
  partyMin: 1,
  partyMax: 6
};

export function validateRsvp(input = {}) {
  const errors = {};
  const value = {};

  // 姓名：必填
  const guestName = typeof input.guest_name === 'string' ? input.guest_name.trim() : '';
  if (!guestName) errors.guest_name = '请填写姓名';
  else if (guestName.length > LIMITS.nameMax) errors.guest_name = `姓名不能超过 ${LIMITS.nameMax} 字`;
  value.guest_name = guestName;

  // 是否参加：必填，且必须是合法值
  const attendance = input.attendance;
  if (attendance !== 'attending' && attendance !== 'declined') {
    errors.attendance = '请选择是否参加';
  }
  value.attendance = attendance;

  let partySize = 0;
  let needsAccommodation = 'no';

  if (attendance === 'attending') {
    const size = Number(input.party_size);
    if (!Number.isInteger(size) || size < LIMITS.partyMin || size > LIMITS.partyMax) {
      errors.party_size = `出席人数需为 ${LIMITS.partyMin}–${LIMITS.partyMax} 人`;
    }
    partySize = Number.isInteger(size) ? size : 0;

    const acc = input.needs_accommodation;
    if (acc !== 'yes' && acc !== 'no') {
      errors.needs_accommodation = '请选择是否需要住宿';
    }
    needsAccommodation = acc === 'yes' ? 'yes' : 'no';
  } else if (attendance === 'declined') {
    // 无法参加：人数固定 0，住宿固定「不需要」
    partySize = 0;
    needsAccommodation = 'no';
  }

  value.party_size = partySize;
  value.needs_accommodation = needsAccommodation;

  // 联系电话：需要住宿时必填，其余情况选填
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  if (needsAccommodation === 'yes' && !phone) {
    errors.phone = '需要住宿时请填写联系电话';
  } else if (phone.length > LIMITS.phoneMax) {
    errors.phone = `联系电话过长（最多 ${LIMITS.phoneMax} 字）`;
  }
  value.phone = phone;

  // 留言：选填，限长
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (message.length > LIMITS.messageMax) {
    errors.message = `留言不能超过 ${LIMITS.messageMax} 字`;
  }
  value.message = message;

  return { ok: Object.keys(errors).length === 0, value, errors };
}
