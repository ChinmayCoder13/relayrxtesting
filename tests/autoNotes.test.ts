import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../src/domain/engine';
import type { ActionType, Role } from '../src/domain/engine';
import { draftNote } from '../src/domain/autoNotes';
import { createCase, seedCases, sampleIntake } from '../src/domain/seed';

const all: ActionType[] = ['verify_identity','verify_prescription','clear_visit','confirm_coverage','approve','hold','release_hold','decline','dispatch','retry','acknowledge','dispense','patient_update','invalidate','escalate','request_info'];

test('every action gets a valid draft that inherits the case details', () => {
  for (const c of seedCases()) for (const t of all) {
    const n = draftNote(t, c, 'staff', 'Jordan Ellis');
    assert.ok(n.length >= 8 && n.length <= 1500, `${t} length`);
    assert.ok(n.includes(c.patient), `${t} names patient`);
    assert.doesNotMatch(n, /undefined|\[object/);
  }
});

test('wording adapts to the case reason and role', () => {
  const missing = createCase('Oliver Chen', 'Metformin', 'Missing information');
  const routine = createCase('Maya Bennett', 'Lisinopril', 'No refills remaining');
  assert.match(draftNote('verify_identity', missing, 'staff', 'Jordan Ellis'), /did not match/);
  assert.doesNotMatch(draftNote('verify_identity', routine, 'staff', 'Jordan Ellis'), /did not match/);
  assert.match(draftNote('approve', routine, 'clinician', 'Dr. Alex Morgan'), /Clinician Dr\. Alex Morgan/);
  assert.match(draftNote('acknowledge', routine, 'pharmacy', 'Sam Lee'), /Cedar Community Pharmacy/);
});

test('draft is accepted by the workflow engine as-is', () => {
  const c = createCase('Test Patient', 'Example medication', 'No refills remaining');
  const note = draftNote('approve', c, 'clinician' as Role, 'Dr. Test');
  const out = applyAction(c, { type: 'approve', note, requestId: 'auto-1', expectedVersion: c.version }, 'clinician', 'Dr. Test');
  assert.equal(out.inputs.approval.verified, true);
});

test('retry draft reports the attempt number', () => {
  let c = createCase('Test Patient', 'Example medication', 'No refills remaining');
  c = applyAction(c, { type: 'approve', note: draftNote('approve', c, 'clinician', 'Dr. T'), requestId: 'a', expectedVersion: c.version }, 'clinician', 'Dr. T');
  c = applyAction(c, { type: 'dispatch', note: draftNote('dispatch', c, 'staff', 'S'), requestId: 'b', expectedVersion: c.version, simulateFailure: true }, 'staff', 'S');
  assert.match(draftNote('retry', c, 'staff', 'S'), /attempt 2 of 3/);
});

test('sample intake returns fictional values', () => {
  const s = sampleIntake(7);
  assert.ok(s.patient.length > 2 && s.medication.length > 2);
});
