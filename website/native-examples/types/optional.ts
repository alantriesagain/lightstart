interface User {
  name: string;
  nickname?: string;
  manager: User | null;
}

function label(user: User): string {
  return user.nickname ?? user.name;
}

function managerName(user: User): string {
  return user.manager?.name ?? "none";
}

const boss: User = { name: "Ada", manager: null };
const users: User[] = [];
for (let i = 0; i < 1000; i++) users.push(i % 2 ? { name: "Bo", nickname: "b", manager: boss } : { name: "Cy", manager: null });

const start = performance.now();
let size = 0;
for (let round = 0; round < 10_000; round++) for (const user of users) size += label(user).length + managerName(user).length;
console.log(size);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
