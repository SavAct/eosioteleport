async function tryCatch(promise, message, alertMsg = null) {
  try {
    await promise;
    assert.fail("Expected addChain function to throw, but it did not");
  } catch (error) {
    assert.include(
      error.message,
      message,
      `${
        alertMsg !== null ? alertMsg + ":" : ""
      } Expected "${message}" but got ${error.message}`
    );
  }
}

module.exports = {
  catchRevert: async function (promise, alertMsg) {
    await tryCatch(promise, "revert", alertMsg);
  },
  catchOutOfGas: async function (promise, alertMsg) {
    await tryCatch(promise, "out of gas", alertMsg);
  },
  catchInvalidJump: async function (promise, alertMsg) {
    await tryCatch(promise, "invalid JUMP", alertMsg);
  },
  catchInvalidOpcode: async function (promise, alertMsg) {
    await tryCatch(promise, "invalid opcode", alertMsg);
  },
  catchStackOverflow: async function (promise, alertMsg) {
    await tryCatch(promise, "stack overflow", alertMsg);
  },
  catchStackUnderflow: async function (promise, alertMsg) {
    await tryCatch(promise, "stack underflow", alertMsg);
  },
  catchStaticStateChange: async function (promise, alertMsg) {
    await tryCatch(promise, "static state change", alertMsg);
  },
};
