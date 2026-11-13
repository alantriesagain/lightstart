let calls = 0;

export default function () {
  calls++;
}

export const getCalls = () => calls;
