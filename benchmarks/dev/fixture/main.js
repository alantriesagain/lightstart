import { alpha } from "dev-fixture/alpha";
import { beta } from "dev-fixture/beta";
import { gamma } from "dev-fixture/gamma";
import { delta } from "dev-fixture/delta";
import { page } from "page-lib";

const total = alpha + beta + gamma + delta + page;

document.querySelector("h1")?.setAttribute("data-total", String(total));
