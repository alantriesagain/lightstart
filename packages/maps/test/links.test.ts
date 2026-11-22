// node-only
/**
 * @file Google Maps and Apple Maps links read without a network: the first
 * such link in shared text, what a link says about its place, and the preview
 * a fetched maps page gives.
 */

import { done, eq } from "@lightstart/test/assert.ts";
import { findMapsLink, parseMapsLink, readPreview } from "../links.js";

const GOOGLE_PLACE = "https://www.google.com/maps/place/Bar+Bip+Bip/@-22.9746541,-43.1906283,17z/data=!3m1!4b1!4m6!3m5!1s0x9bd5554b9b8f0a7d:0x6c4e3f1a2b3c4d5e!8m2!3d-22.9746591!4d-43.1880534!16s%2Fg%2F1tf2k0sx?entry=ttu&g_ep=EgoyMDI2MDkyOC4wIKXMDSoASAFQAw%3D%3D";
const GOOGLE_PIN = "https://www.google.com/maps/place/22%C2%B058'26.5%22S+43%C2%B011'17.0%22W/@-22.97404,-43.18805,17z/data=!3m1!4b1!4m4!3m3!8m2!3d-22.9740278!4d-43.1880556?entry=ttu";
const APPLE_SHARE = "https://maps.apple.com/?address=Rua%20Almirante%20Gon%C3%A7alves%2050,%20Copacabana,%20Rio%20de%20Janeiro%20-%20RJ,%2022060-040,%20Brazil&auid=1234567890123456789&ll=-22.974659,-43.188053&lsp=9902&q=Bar%20Bip%20Bip";

const GOOGLE_HTML = `<!DOCTYPE html><html lang="en"><head>
<meta content="IE=edge,chrome=1" http-equiv="X-UA-Compatible">
<meta content="Bar Bip Bip · R. Almirante Gonçalves, 50 - Copacabana, Rio de Janeiro - RJ, 22060-040" property="og:title">
<meta content="★★★★★ · Bar" property="og:description">
<meta content="https://lh5.googleusercontent.com/p/AF1QipN0bipbip=w900-h900-k-no" property="og:image">
<meta content="900" property="og:image:width">
<meta content="summary" name="twitter:card">
<title>Bar Bip Bip · R. Almirante Gonçalves, 50 - Copacabana - Google Maps</title>
</head><body></body></html>`;

const GOOGLE_STATIC_HTML = `<html><head>
<meta content="" property="og:title">
<meta content="//maps.google.com/maps/api/staticmap?center=-22.9132%2C-43.1789&amp;zoom=16&amp;size=900x900&amp;language=en&amp;markers=color%3Ared%7C-22.9152%2C-43.1791&amp;sensor=false" property="og:image">
<title>Escadaria Selar&#243;n &amp; Arcos - Google Maps</title>
</head></html>`;

const APPLE_HTML = `<!doctype html><html><head>
<meta charset="utf-8">
<meta property='og:title' content='Arpoador'>
<meta property="og:url" content="https://maps.apple.com/place?place-id=I6F2E1B8C2D3A4B5&amp;_provider=9902">
<meta property="og:image" content="https://snapshot.apple-mapkit.com/api/v1/snapshot?center=-22.9887,-43.1925&amp;z=15&amp;size=600x315">
<meta property="place:location:latitude" content="-22.98871">
<meta property="place:location:longitude" content="-43.19251">
<meta name="twitter:title" content="Arpoador · Apple Maps">
<title>Arpoador – Apple Maps</title>
</head></html>`;

eq("the link Android shares under a place's name is found", findMapsLink("Bar Bip Bip\nhttps://maps.app.goo.gl/q8hS7kJmW3dX2vNb7") ?? "", "https://maps.app.goo.gl/q8hS7kJmW3dX2vNb7");
const sentence = "See https://example.com/menu and the map (https://maps.apple.com/?ll=-22.9868,-43.2045&q=Arpoador).";
eq("other links are skipped and a sentence's punctuation trimmed", findMapsLink(sentence) ?? "", "https://maps.apple.com/?ll=-22.9868,-43.2045&q=Arpoador");
eq("text with no maps link answers null", String(findMapsLink("Meet at the beach at 5")), "null");
eq("a search page is not a maps link", String(findMapsLink("https://www.google.com/search?q=bar+bip+bip")), "null");
eq("empty text answers null", String(findMapsLink("")), "null");

eq("the !3d!4d pair wins over the @ centre, and the name comes from the path", JSON.stringify(parseMapsLink(GOOGLE_PLACE)), JSON.stringify({
  provider: "google", url: GOOGLE_PLACE, name: "Bar Bip Bip", lat: -22.9746591, lng: -43.1880534, short: false,
}));
const regional = parseMapsLink("https://www.google.com.br/maps/place/Escadaria+Selar%C3%B3n/@-22.915,-43.179,17z");
eq("the @ centre is the fallback and the name is decoded", JSON.stringify([regional?.name, regional?.lat, regional?.lng]), JSON.stringify(["Escadaria Selarón", -22.915, -43.179]));
const dropped = parseMapsLink(GOOGLE_PIN);
eq("a dropped pin names no place and keeps its coordinates", JSON.stringify([dropped?.name, dropped?.lat, dropped?.lng]), JSON.stringify(["", -22.9740278, -43.1880556]));
const pair = parseMapsLink("https://maps.google.com/?q=-22.9711,-43.1822");
eq("q may carry coordinates", JSON.stringify([pair?.name, pair?.lat, pair?.lng]), JSON.stringify(["", -22.9711, -43.1822]));
const named = parseMapsLink("https://www.google.com/maps?q=Pedra+do+Sal,+Sa%C3%BAde");
eq("q may carry a name", JSON.stringify([named?.name, named?.lat, named?.lng]), JSON.stringify(["Pedra do Sal, Saúde", null, null]));
eq("query= is read from a Maps URLs link", parseMapsLink("https://www.google.com/maps/search/?api=1&query=Praia+de+Ipanema")?.name ?? "", "Praia de Ipanema");
const queryPair = parseMapsLink("https://www.google.com/maps/search/?api=1&query=-22.9868%2C-43.2045");
eq("a coordinate search query is read", JSON.stringify([queryPair?.lat, queryPair?.lng]), JSON.stringify([-22.9868, -43.2045]));
const searchPath = parseMapsLink("https://www.google.com/maps/search/-22.9711,+-43.1822?entry=tts");
eq("a coordinate search path is read", JSON.stringify([searchPath?.name, searchPath?.lat, searchPath?.lng]), JSON.stringify(["", -22.9711, -43.1822]));
eq("a short link says so", JSON.stringify(parseMapsLink("https://maps.app.goo.gl/q8hS7kJmW3dX2vNb7")), JSON.stringify({
  provider: "google", url: "https://maps.app.goo.gl/q8hS7kJmW3dX2vNb7", name: "", lat: null, lng: null, short: true,
}));
eq("a goo.gl maps link is short", String(parseMapsLink("https://goo.gl/maps/AbCdEf12345")?.short), "true");
eq("coordinates out of range are left out", String(parseMapsLink("https://maps.google.com/?q=95.1,-43.1")?.lat), "null");
eq("a goo.gl link outside maps is not one", String(parseMapsLink("https://goo.gl/AbCdEf")), "null");
eq("a google search is not a maps link", String(parseMapsLink("https://www.google.com/search?q=maps")), "null");
eq("another host's maps path is not one", String(parseMapsLink("https://example.com/maps/place/Bar/@-22.9,-43.1,17z")), "null");
eq("a non-http scheme is not one", String(parseMapsLink("ftp://maps.google.com/?q=-22.9,-43.1")), "null");
eq("text that is not a url is not one", String(parseMapsLink("not a url")), "null");

eq("an Apple share link reads ll and q, q the name over the address", JSON.stringify(parseMapsLink(APPLE_SHARE)), JSON.stringify({
  provider: "apple", url: APPLE_SHARE, name: "Bar Bip Bip", lat: -22.974659, lng: -43.188053, short: false,
}));
const addressed = parseMapsLink("https://maps.apple.com/?address=Rua+do+Ouvidor+50,+Centro,+Rio+de+Janeiro");
eq("an address names the place when that is all there is", JSON.stringify([addressed?.name, addressed?.lat, addressed?.lng]), JSON.stringify(["Rua do Ouvidor 50, Centro, Rio de Janeiro", null, null]));
eq("a maps.apple/p link is short", JSON.stringify(parseMapsLink("https://maps.apple/p/Qx9mHk2LpZ7.Ab")), JSON.stringify({
  provider: "apple", url: "https://maps.apple/p/Qx9mHk2LpZ7.Ab", name: "", lat: null, lng: null, short: true,
}));

eq("a Google place page gives the name without address or suffix, the photo and the URL's coordinates", JSON.stringify(readPreview(GOOGLE_HTML, GOOGLE_PLACE)), JSON.stringify({
  title: "Bar Bip Bip",
  image: "https://lh5.googleusercontent.com/p/AF1QipN0bipbip=w900-h900-k-no",
  url: GOOGLE_PLACE,
  lat: -22.9746591,
  lng: -43.1880534,
}));
const staticPreview = readPreview(GOOGLE_STATIC_HTML, "https://www.google.com/maps?q=Escadaria+Selaron");
eq("an empty og:title falls back to the title tag, with its entities decoded", staticPreview.title, "Escadaria Selarón & Arcos");
eq("a protocol-relative image becomes https", String(staticPreview.image.startsWith("https://maps.google.com/maps/api/staticmap?center=")), "true");
eq("the static map's marker is the position", JSON.stringify([staticPreview.lat, staticPreview.lng]), JSON.stringify([-22.9152, -43.1791]));
const centreHtml = `<meta property="og:image" content="https://maps.google.com/maps/api/staticmap?center=-22.9132%2C-43.1789&amp;zoom=16">`;
const centrePreview = readPreview(centreHtml, "https://www.google.com/maps?q=Selaron");
eq("a static map's center is the fallback position", JSON.stringify([centrePreview.lat, centrePreview.lng]), JSON.stringify([-22.9132, -43.1789]));
eq("an Apple page reads og:url and the place:location tags before the snapshot", JSON.stringify(readPreview(APPLE_HTML, "https://maps.apple.com/place?place-id=I6F2E1B8C2D3A4B5&_provider=9902")), JSON.stringify({
  title: "Arpoador",
  image: "https://snapshot.apple-mapkit.com/api/v1/snapshot?center=-22.9887,-43.1925&z=15&size=600x315",
  url: "https://maps.apple.com/place?place-id=I6F2E1B8C2D3A4B5&_provider=9902",
  lat: -22.98871,
  lng: -43.19251,
}));
eq("a twitter title loses its suffix", readPreview(`<meta name="twitter:title" content="Arpoador · Apple Maps">`, "").title, "Arpoador");
eq("a page that only says Google Maps has no title", readPreview("<title>Google Maps</title>", "https://www.google.com/maps").title, "");
eq("a page with nothing gives an empty preview but its URL", JSON.stringify(readPreview("", "https://maps.app.goo.gl/q8hS7kJmW3dX2vNb7")), JSON.stringify({
  title: "", image: "", url: "https://maps.app.goo.gl/q8hS7kJmW3dX2vNb7", lat: null, lng: null,
}));

done();
