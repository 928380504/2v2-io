const state = { blueprint: null, revision: "", token: "", selectedGame: 0, dirty: false, jsonValid: true, preview: null, competitionAdapters: [], resources: [], resourceTarget: null, structuredSections: [], structuredApply: null };
const sectionCopy = {
  site: ["Site identity", "Edit the site name, domain, assets, and search metadata."],
  routes: ["Routes & category", "Control public collection paths and primary category metadata."],
  theme: ["Theme & features", "Change site colors, layout values, and public feature switches."],
  pages: ["Page content", "Manage the home page, FAQ, Hot Games, and filter-page copy."],
  games: ["Game catalog", "Manage the single catalog used by routes, cards, filters, and SEO."],
  filters: ["Game filters", "Build the reusable attributes used by discovery and recommendations."],
  legal: ["Legal content", "Maintain five legal pages and the reusable About Us sections."],
  deployment: ["Deployment", "Configure Cloudflare Pages, D1, competition, and ranking exclusions."],
  advanced: ["Advanced JSON", "Edit every blueprint field while visual coverage grows over time."],
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clone = (value) => JSON.parse(JSON.stringify(value));
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
const titleCase = (value) => String(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const get = (path) => path.split(".").reduce((value, key) => value?.[key], state.blueprint);
const set = (path, value) => {
  const keys = path.split("."); let owner = state.blueprint;
  keys.slice(0, -1).forEach((key) => { owner = owner[key] ??= {}; });
  owner[keys.at(-1)] = value;
  markDirty();
};

function readToken() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const token = hash.get("token") || sessionStorage.getItem("siteAdminToken") || "";
  if (hash.get("token")) {
    sessionStorage.setItem("siteAdminToken", token);
    history.replaceState(null, "", location.pathname);
  }
  return token;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", "X-Site-Admin-Token": state.token, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
  if (!response.ok || !payload.ok) throw Object.assign(new Error(payload.error || "Request failed."), { payload, status: response.status });
  return payload;
}

function notice(message, type = "success") {
  const element = $("#notice");
  element.textContent = message;
  element.className = `notice${type === "error" ? " error" : ""}`;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => element.classList.add("hidden"), type === "error" ? 8000 : 4500);
}

function markDirty() {
  state.dirty = true;
  state.preview = null;
  $("#save-state").textContent = state.jsonValid ? "Unsaved changes" : "JSON needs attention";
  $("#save-state").className = "state-pill dirty";
  $("#save-button").disabled = !state.jsonValid;
  if (!$("#section-advanced").classList.contains("active")) syncJsonEditor();
}

function markSaved() {
  state.dirty = false;
  $("#save-state").textContent = "Saved";
  $("#save-state").className = "state-pill saved";
  $("#save-button").disabled = true;
}

function resourcePreviewUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (source.startsWith("/")) return `/preview/public/${source.slice(1).split("/").map(encodeURIComponent).join("/")}`;
  if (/^https:\/\//i.test(source)) return source;
  const origin = String(state.blueprint?.site?.assets?.gameOrigin || "").trim();
  if (!origin) return "";
  try { return new URL(source, `${origin.replace(/\/+$/, "")}/`).href; } catch { return ""; }
}

function resourcePreviewMarkup(value, target) {
  const preview = resourcePreviewUrl(value);
  return `<div class="resource-preview${preview ? "" : " empty"}" data-resource-preview="${escapeHtml(target)}">${preview ? `<img src="${escapeHtml(preview)}" alt="Selected resource preview"><code>${escapeHtml(value)}</code>` : "<span>No image selected</span>"}</div>`;
}

function fieldMarkup(definition) {
  const value = get(definition.path);
  const wide = definition.wide ? " wide" : "";
  const hint = definition.hint ? `<small>${escapeHtml(definition.hint)}</small>` : "";
  let control;
  if (definition.type === "textarea") control = `<textarea data-path="${definition.path}" rows="${definition.rows || 4}">${escapeHtml(value)}</textarea>${definition.structured ? `<button class="button secondary small structured-button" type="button" data-structured-path="${definition.path}" data-structured-title="${escapeHtml(definition.label)}">Edit sections visually</button>` : ""}`;
  else if (definition.type === "boolean") control = `<input class="switch" data-path="${definition.path}" type="checkbox"${value ? " checked" : ""}>`;
  else if (definition.type === "select") control = `<select data-path="${definition.path}">${definition.options.map(([optionValue, label]) => `<option value="${escapeHtml(optionValue)}"${String(value) === optionValue ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
  else if (definition.type === "color") control = `<div class="color-row"><input data-color-for="${definition.path}" type="color" value="${escapeHtml(value)}"><input data-path="${definition.path}" value="${escapeHtml(value)}"></div>`;
  else control = `<input data-path="${definition.path}" type="${definition.type || "text"}" value="${escapeHtml(Array.isArray(value) ? value.join(", ") : value)}"${definition.min !== undefined ? ` min="${definition.min}"` : ""}${definition.max !== undefined ? ` max="${definition.max}"` : ""}>`;
  if (definition.resource) control = `<div class="resource-control">${control}<button class="button secondary" type="button" data-resource-for="${definition.path}">Browse public images</button></div>${resourcePreviewMarkup(value, definition.path)}`;
  return `<label class="field${wide}"><span>${escapeHtml(definition.label)}</span>${control}${hint}</label>`;
}

function bindFields(root, definitions) {
  $$('[data-path]', root).forEach((input) => input.addEventListener("input", () => {
    const definition = definitions.find((item) => item.path === input.dataset.path) || {};
    let value = definition.type === "boolean" ? input.checked : input.value;
    if (definition.array) value = value.split(",").map((item) => item.trim()).filter(Boolean);
    if (definition.type === "number") value = Number(value);
    set(input.dataset.path, value);
    const color = $(`[data-color-for="${CSS.escape(input.dataset.path)}"]`, root);
    if (color && /^#[0-9a-f]{6}$/i.test(String(value))) color.value = value;
    if (definition.resource) updateResourcePreview(input.dataset.path, value, root);
  }));
  $$('[data-color-for]', root).forEach((input) => input.addEventListener("input", () => {
    const textInput = $(`[data-path="${CSS.escape(input.dataset.colorFor)}"]`, root);
    textInput.value = input.value;
    set(input.dataset.colorFor, input.value);
  }));
  $$('[data-resource-for]', root).forEach((button) => button.addEventListener("click", () => {
    openResourceDialog($(`[data-path="${CSS.escape(button.dataset.resourceFor)}"]`, root));
  }));
  $$('[data-structured-path]', root).forEach((button) => button.addEventListener("click", () => {
    const input = $(`[data-path="${CSS.escape(button.dataset.structuredPath)}"]`, root);
    openStructuredDialog(input.value, button.dataset.structuredTitle, (html) => { input.value = html; input.dispatchEvent(new Event("input", { bubbles:true })); });
  }));
}

function updateResourcePreview(target, value, root = document) {
  const current = $(`[data-resource-preview="${CSS.escape(target)}"]`, root);
  if (!current) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = resourcePreviewMarkup(value, target);
  current.replaceWith(wrapper.firstElementChild);
}

function renderResourceGallery() {
  const query = $("#resource-search").value.trim().toLowerCase();
  const matches = state.resources.filter((resource) => !query || resource.path.toLowerCase().includes(query));
  const root = $("#resource-gallery");
  root.innerHTML = matches.length ? matches.map((resource) => `<button class="resource-card" type="button" data-resource-path="${escapeHtml(resource.path)}"><span class="resource-image"><img src="${escapeHtml(resourcePreviewUrl(resource.path))}" alt="" loading="lazy"></span><strong>${escapeHtml(resource.name)}</strong><small>${escapeHtml(resource.path)} · ${Math.max(1, Math.round(resource.bytes / 1024))} KB</small></button>`).join("") : '<p class="empty-state">No matching images were found in public/.</p>';
  $$('[data-resource-path]', root).forEach((button) => button.addEventListener("click", () => {
    if (!state.resourceTarget) return;
    state.resourceTarget.value = button.dataset.resourcePath;
    state.resourceTarget.dispatchEvent(new Event("input", { bubbles:true }));
    $("#resource-dialog").close();
  }));
}

function openResourceDialog(target) {
  if (!target) return;
  state.resourceTarget = target;
  $("#resource-search").value = "";
  renderResourceGallery();
  $("#resource-dialog").showModal();
  setTimeout(() => $("#resource-search").focus(), 50);
}

function parseStructuredHtml(value) {
  const documentValue = new DOMParser().parseFromString(`<body>${String(value || "")}</body>`, "text/html");
  const blocks = [...documentValue.body.childNodes].filter((node) => node.nodeType !== Node.TEXT_NODE || node.textContent.trim());
  return blocks.map((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE || node.tagName.toLowerCase() !== "section") {
      return { raw:true, bodyHtml:node.nodeType === Node.ELEMENT_NODE ? node.outerHTML : node.textContent };
    }
    const copy = node.cloneNode(true);
    const heading = [...copy.children].find((child) => /^H[1-6]$/.test(child.tagName));
    if (heading) heading.remove();
    return {
      raw:false,
      className:node.getAttribute("class") || "",
      attributes:[...node.attributes].filter((attribute) => attribute.name !== "class").map((attribute) => [attribute.name, attribute.value]),
      headingTag:heading?.tagName.toLowerCase() || "h3",
      headingAttributes:heading ? [...heading.attributes].map((attribute) => [attribute.name, attribute.value]) : [],
      headingHtml:heading?.innerHTML || "Section heading",
      bodyHtml:copy.innerHTML.trim(),
    };
  });
}

function syncStructuredSections() {
  $$('[data-structured-index]', $("#structured-section-list")).forEach((card) => {
    const section = state.structuredSections[Number(card.dataset.structuredIndex)];
    if (!section) return;
    if (section.raw) section.bodyHtml = $("[data-structured-raw]", card).value;
    else {
      section.className = $("[data-structured-class]", card).value;
      section.headingTag = $("[data-structured-heading-tag]", card).value;
      section.headingHtml = $("[data-structured-heading]", card).value;
      section.bodyHtml = $("[data-structured-body]", card).value;
    }
  });
}

function renderStructuredSections() {
  const root = $("#structured-section-list");
  root.innerHTML = state.structuredSections.length ? state.structuredSections.map((section, index) => section.raw
    ? `<article class="structured-card" data-structured-index="${index}"><div class="structured-toolbar"><strong>Raw HTML block ${index + 1}</strong><div><button class="button small secondary" type="button" data-structured-move="up"${index === 0 ? " disabled" : ""}>↑</button><button class="button small secondary" type="button" data-structured-move="down"${index === state.structuredSections.length - 1 ? " disabled" : ""}>↓</button><button class="button small danger" type="button" data-structured-remove>Remove</button></div></div><label class="field"><span>Preserved HTML</span><textarea data-structured-raw rows="8">${escapeHtml(section.bodyHtml)}</textarea></label></article>`
    : `<article class="structured-card" data-structured-index="${index}"><div class="structured-toolbar"><strong>Section ${index + 1}</strong><div><button class="button small secondary" type="button" data-structured-move="up"${index === 0 ? " disabled" : ""}>↑</button><button class="button small secondary" type="button" data-structured-move="down"${index === state.structuredSections.length - 1 ? " disabled" : ""}>↓</button><button class="button small danger" type="button" data-structured-remove>Remove</button></div></div><div class="structured-grid"><label class="field"><span>Heading level</span><select data-structured-heading-tag>${[1,2,3,4,5,6].map((level) => `<option value="h${level}"${section.headingTag === `h${level}` ? " selected" : ""}>H${level}</option>`).join("")}</select></label><label class="field"><span>Section CSS classes</span><input data-structured-class value="${escapeHtml(section.className)}"></label><label class="field wide"><span>Heading</span><input data-structured-heading value="${escapeHtml(section.headingHtml)}"></label><label class="field wide"><span>Body HTML</span><textarea data-structured-body rows="8">${escapeHtml(section.bodyHtml)}</textarea></label></div></article>`).join("") : '<p class="empty-state">No sections yet. Add one below.</p>';
  $$('[data-structured-move]', root).forEach((button) => button.addEventListener("click", () => {
    syncStructuredSections();
    const index = Number(button.closest("[data-structured-index]").dataset.structuredIndex);
    const destination = button.dataset.structuredMove === "up" ? index - 1 : index + 1;
    [state.structuredSections[index], state.structuredSections[destination]] = [state.structuredSections[destination], state.structuredSections[index]];
    renderStructuredSections();
  }));
  $$('[data-structured-remove]', root).forEach((button) => button.addEventListener("click", () => {
    syncStructuredSections();
    state.structuredSections.splice(Number(button.closest("[data-structured-index]").dataset.structuredIndex), 1);
    renderStructuredSections();
  }));
}

function openStructuredDialog(value, title, apply) {
  state.structuredSections = parseStructuredHtml(value);
  state.structuredApply = apply;
  $("#structured-dialog-title").textContent = title || "Edit article sections";
  renderStructuredSections();
  $("#structured-dialog").showModal();
}

function serializeAttributes(attributes) {
  return attributes.map(([name, value]) => ` ${name}="${escapeHtml(value)}"`).join("");
}

function applyStructuredSections() {
  syncStructuredSections();
  const html = state.structuredSections.map((section) => {
    if (section.raw) return section.bodyHtml;
    const classAttribute = section.className.trim() ? ` class="${escapeHtml(section.className.trim())}"` : "";
    return `<section${classAttribute}${serializeAttributes(section.attributes)}><${section.headingTag}${serializeAttributes(section.headingAttributes)}>${section.headingHtml}</${section.headingTag}>${section.bodyHtml}</section>`;
  }).join("\n");
  state.structuredApply?.(html);
  $("#structured-dialog").close();
}

function renderSimpleFields(target, definitions) {
  const root = $(target);
  root.innerHTML = definitions.map(fieldMarkup).join("");
  bindFields(root, definitions);
}

function renderSite() {
  renderSimpleFields("#site-fields", [
    { path:"site.id", label:"Site ID", hint:"Lowercase letters, numbers, and hyphens." },
    { path:"site.name", label:"Site name" }, { path:"site.brandName", label:"Brand name" },
    { path:"site.domain", label:"Domain", hint:"No protocol or path." }, { path:"site.email", label:"Contact email", type:"email" },
    { path:"site.timeZone", label:"Competition time zone" }, { path:"site.primaryGameId", label:"Primary game" },
    { path:"site.legalLastUpdated", label:"Legal last updated" }, { path:"site.feedbackProjectKey", label:"Feedback project key", wide:true },
  ]);
  renderSimpleFields("#asset-fields", [
    { path:"site.assets.gameOrigin", label:"Game asset origin", wide:true }, { path:"site.assets.logo", label:"Site logo", resource:true },
    { path:"site.assets.navigationLogo", label:"Navigation logo", resource:true }, { path:"site.assets.favicon", label:"Favicon", resource:true },
    { path:"home.backgroundImage", label:"Home background image", resource:true },
  ]);
  renderSimpleFields("#seo-fields", [
    { path:"site.seo.title", label:"SEO title", wide:true }, { path:"site.seo.description", label:"SEO description", type:"textarea", wide:true },
    { path:"site.seo.keywords", label:"Keywords", array:true, wide:true, hint:"Separate keywords with commas." }, { path:"site.seo.twitterCreator", label:"Twitter creator" },
  ]);
}

function renderRoutes() {
  renderSimpleFields("#route-fields", [
    { path:"routes.categoryPath", label:"Category path" }, { path:"routes.filterPath", label:"Filter path" }, { path:"routes.filterLabel", label:"Filter navigation label", wide:true },
  ]);
  renderSimpleFields("#category-fields", [
    { path:"category.id", label:"Category ID" }, { path:"category.title", label:"Catalog title" },
    { path:"category.heading", label:"Page heading", wide:true }, { path:"category.description", label:"Page description", type:"textarea", wide:true },
    { path:"category.catalogDescription", label:"Catalog card description", type:"textarea", wide:true },
    { path:"category.metadataTitle", label:"Metadata title", wide:true }, { path:"category.metadataDescription", label:"Metadata description", type:"textarea", wide:true },
    { path:"category.socialDescription", label:"Social description", type:"textarea", wide:true }, { path:"category.keywords", label:"Keywords", wide:true },
  ]);
}

function renderTheme() {
  renderSimpleFields("#theme-fields", [
    { path:"theme.defaultMode", label:"Default mode", type:"select", options:[["light","Light"],["dark","Dark"],["system","System"]] },
    { path:"theme.colors.pageLight", label:"Light page color", type:"color" }, { path:"theme.colors.pageDark", label:"Dark page color", type:"color" },
    { path:"theme.colors.primaryLight", label:"Light primary color", type:"color" }, { path:"theme.colors.primaryDark", label:"Dark primary color", type:"color" },
    { path:"theme.layout.gameBaseMaxWidth", label:"Site base maximum width" },
    { path:"theme.layout.gameDesktopWidth", label:"Desktop site width" }, { path:"theme.layout.gameDesktopMaxWidth", label:"Desktop site maximum width" },
  ]);
  const root = $("#feature-fields");
  root.innerHTML = Object.entries(state.blueprint.features).map(([key, enabled]) => `<label class="toggle"><span>${escapeHtml(titleCase(key))}</span><input class="switch" type="checkbox" data-feature="${escapeHtml(key)}"${enabled ? " checked" : ""}></label>`).join("");
  $$('[data-feature]', root).forEach((input) => input.addEventListener("change", () => { state.blueprint.features[input.dataset.feature] = input.checked; markDirty(); }));
}

function renderPages() {
  renderSimpleFields("#home-fields", [
    { path:"home.coverTagline", label:"Cover tagline", wide:true },
    { path:"home.structuredImageCaption", label:"Structured image caption" }, { path:"home.heroAlt", label:"Article image alt text" },
    { path:"home.relatedGameIds", label:"Related game IDs", array:true, wide:true, hint:"Separate game IDs with commas." },
    { path:"home.descriptionHtml", label:"Home article HTML", type:"textarea", rows:16, wide:true, structured:true },
    { path:"home.youtube.videoId", label:"YouTube video ID" }, { path:"home.youtube.title", label:"YouTube title" },
    { path:"home.youtube.description", label:"YouTube description", type:"textarea", wide:true },
  ]);
  renderFaq();
  renderSimpleFields("#hot-games-fields", [
    { path:"hotGames.heading", label:"Page heading" }, { path:"hotGames.limit", label:"Maximum games", type:"number", min:1, max:100 },
    { path:"hotGames.description", label:"Page description", type:"textarea", wide:true }, { path:"hotGames.metadataTitle", label:"Metadata title", wide:true },
    { path:"hotGames.metadataDescription", label:"Metadata description", type:"textarea", wide:true }, { path:"hotGames.socialDescription", label:"Social description", type:"textarea", wide:true },
    { path:"hotGames.keywords", label:"Keywords", wide:true },
  ]);
  renderSimpleFields("#filter-page-fields", [
    { path:"filterPage.heading", label:"Page heading" }, { path:"filterPage.filteredHeadingSuffix", label:"Filtered heading suffix" },
    { path:"filterPage.description", label:"Page description", type:"textarea", wide:true }, { path:"filterPage.resultNoun", label:"Result noun" },
    { path:"filterPage.attributesTitle", label:"Attributes title" }, { path:"filterPage.attributesDescription", label:"Attributes description", type:"textarea", wide:true },
    { path:"filterPage.resultsTitle", label:"Results title" }, { path:"filterPage.emptyTitle", label:"Empty-state title" },
    { path:"filterPage.clearLabel", label:"Clear label" }, { path:"filterPage.clearAllLabel", label:"Clear-all label" },
    { path:"filterPage.metadataTitle", label:"Metadata title", wide:true }, { path:"filterPage.metadataDescription", label:"Metadata description", type:"textarea", wide:true },
    { path:"filterPage.legacyMessage", label:"Legacy-page message" }, { path:"filterPage.legacyLinkLabel", label:"Legacy-page link label" },
    { path:"filterPage.legacyMetadataTitle", label:"Legacy metadata title", wide:true }, { path:"filterPage.legacyMetadataDescription", label:"Legacy metadata description", type:"textarea", wide:true },
  ]);
}

function renderFaq() {
  const root=$("#faq-editor");
  root.innerHTML=state.blueprint.home.faqItems.map((item,index)=>`<article class="card repeat-card"><div class="repeat-head"><div><h3>Question ${index+1}</h3></div><button class="button danger small" type="button" data-remove-faq="${index}"${state.blueprint.home.faqItems.length===1?" disabled":""}>Remove</button></div><div class="repeat-grid"><label class="field wide"><span>Question</span><input data-faq-key="question" data-faq-index="${index}" value="${escapeHtml(item.question)}"></label><label class="field wide"><span>Answer</span><textarea data-faq-key="answer" data-faq-index="${index}" rows="4">${escapeHtml(item.answer)}</textarea></label></div></article>`).join("");
  $$('[data-faq-key]',root).forEach((input)=>input.addEventListener("input",()=>{state.blueprint.home.faqItems[Number(input.dataset.faqIndex)][input.dataset.faqKey]=input.value;markDirty();}));
  $$('[data-remove-faq]',root).forEach((button)=>button.addEventListener("click",()=>{state.blueprint.home.faqItems.splice(Number(button.dataset.removeFaq),1);markDirty();renderFaq();}));
}

function addFaq() { state.blueprint.home.faqItems.push({question:"New question?",answer:"Add a clear and useful answer for players."});markDirty();renderFaq(); }

function renderLegal() {
  const pageOrder=["aboutUs","contactUs","dmca","terms","privacy"];
  const root=$("#legal-pages-editor");
  const definitions=[];
  root.innerHTML=pageOrder.map((key)=>{const page=state.blueprint.legal.pages[key];const fields=[
    {path:`legal.pages.${key}.navLabel`,label:"Navigation label"},{path:`legal.pages.${key}.eyebrow`,label:"Eyebrow"},
    {path:`legal.pages.${key}.title`,label:"Page title",wide:true},{path:`legal.pages.${key}.metadataTitle`,label:"Metadata title",wide:true},
    {path:`legal.pages.${key}.description`,label:"Page description",type:"textarea",wide:true},{path:`legal.pages.${key}.seoDescription`,label:"SEO description",type:"textarea",wide:true},
    {path:`legal.pages.${key}.showLastUpdated`,label:"Show last-updated date",type:"boolean"},
  ];definitions.push(...fields);return `<article class="card repeat-card"><div class="repeat-head"><div><h2>${escapeHtml(page.navLabel)}</h2><span class="legal-route">${escapeHtml(page.path)}</span></div></div><div class="repeat-grid">${fields.map(fieldMarkup).join("")}</div></article>`;}).join("");
  bindFields(root,definitions);
  renderAbout();
}

function renderAbout() {
  const root=$("#about-editor");
  const sectionKeys=["whyBuilt","catalog","profiles","independence"];
  root.innerHTML=sectionKeys.map((key)=>{const section=state.blueprint.legal.aboutUs[key];return `<article class="card repeat-card" data-about-card="${key}"><div class="repeat-head"><div><h2>${escapeHtml(section.title)}</h2><span class="legal-route">${escapeHtml(key)}</span></div><button class="button secondary small" type="button" data-add-paragraph="${key}">+ Paragraph</button></div><div class="repeat-grid"><label class="field wide"><span>Section title</span><input data-about-title="${key}" value="${escapeHtml(section.title)}"></label><div class="field wide"><span>Paragraphs</span><div class="paragraph-list">${section.paragraphs.map((paragraph,index)=>`<div class="paragraph-row"><textarea data-about-paragraph="${key}" data-paragraph-index="${index}">${escapeHtml(paragraph)}</textarea><button class="button danger small" type="button" data-remove-paragraph="${key}" data-paragraph-index="${index}"${section.paragraphs.length===1?" disabled":""}>Remove</button></div>`).join("")}</div></div>${key==="profiles"?`<label class="field"><span>Privacy link label</span><input data-about-extra="profiles.privacyLinkLabel" value="${escapeHtml(section.privacyLinkLabel)}"></label>`:""}</div></article>`;}).join("")+(()=>{const contact=state.blueprint.legal.aboutUs.contact;return `<article class="card repeat-card"><div class="repeat-head"><div><h2>${escapeHtml(contact.title)}</h2><span class="legal-route">contact</span></div></div><div class="repeat-grid">${[["title","Section title"],["lead","Lead text"],["linkLabel","Link label"],["suffix","Suffix"]].map(([key,label])=>`<label class="field${key==="lead"?" wide":""}"><span>${label}</span><input data-contact-key="${key}" value="${escapeHtml(contact[key])}"></label>`).join("")}</div></article>`;})();
  $$('[data-about-title]',root).forEach((input)=>input.addEventListener("input",()=>{state.blueprint.legal.aboutUs[input.dataset.aboutTitle].title=input.value;markDirty();}));
  $$('[data-about-paragraph]',root).forEach((input)=>input.addEventListener("input",()=>{state.blueprint.legal.aboutUs[input.dataset.aboutParagraph].paragraphs[Number(input.dataset.paragraphIndex)]=input.value;markDirty();}));
  $$('[data-add-paragraph]',root).forEach((button)=>button.addEventListener("click",()=>{state.blueprint.legal.aboutUs[button.dataset.addParagraph].paragraphs.push("Add a useful paragraph here.");markDirty();renderAbout();}));
  $$('[data-remove-paragraph]',root).forEach((button)=>button.addEventListener("click",()=>{state.blueprint.legal.aboutUs[button.dataset.removeParagraph].paragraphs.splice(Number(button.dataset.paragraphIndex),1);markDirty();renderAbout();}));
  $$('[data-about-extra]',root).forEach((input)=>input.addEventListener("input",()=>set(`legal.aboutUs.${input.dataset.aboutExtra}`,input.value)));
  $$('[data-contact-key]',root).forEach((input)=>input.addEventListener("input",()=>{state.blueprint.legal.aboutUs.contact[input.dataset.contactKey]=input.value;markDirty();}));
}

function renderDeployment() {
  renderSimpleFields("#cloudflare-fields", [
    {path:"cloudflare.accountId",label:"Cloudflare account ID",wide:true,hint:"This identifier is not an API token."},
    {path:"cloudflare.pagesProject",label:"Pages project"},{path:"cloudflare.productionBranch",label:"Production branch"},
    {path:"cloudflare.database.binding",label:"D1 binding name"},{path:"cloudflare.database.name",label:"D1 database name"},
    {path:"cloudflare.database.id",label:"Production D1 UUID",wide:true},{path:"cloudflare.database.previewId",label:"Preview D1 UUID",wide:true},
    {path:"cloudflare.database.location",label:"D1 location hint",type:"select",options:[["wnam","Western North America"],["enam","Eastern North America"],["weur","Western Europe"],["eeur","Eastern Europe"],["apac","Asia Pacific"],["oc","Oceania"]]},
  ]);
  const competition=$("#competition-fields");
  const adapterOptions=state.competitionAdapters.map((adapter)=>[adapter.id,adapter.displayName]);
  const definitions=[{path:"competition.adapterId",label:"Competition adapter",type:"select",options:adapterOptions}];
  competition.innerHTML='<div class="deployment-warning">Credentials are intentionally excluded. Keep API tokens in Wrangler login or encrypted environment variables.</div>'+definitions.map(fieldMarkup).join("");
  bindFields(competition,definitions);
  renderRankingExclusions();
}

function renderRankingExclusions() {
  const root=$("#ranking-exclusions");const excluded=new Set(state.blueprint.ranking.excludedGameIds||[]);
  root.innerHTML=`<h3>Ranking exclusions</h3><div class="game-check-grid">${state.blueprint.games.map((game)=>`<label class="game-check"><input type="checkbox" data-ranking-game="${escapeHtml(game.id)}"${excluded.has(game.id)?" checked":""}><span>${escapeHtml(game.title)}</span></label>`).join("")}</div>`;
  $$('[data-ranking-game]',root).forEach((input)=>input.addEventListener("change",()=>{const values=new Set(state.blueprint.ranking.excludedGameIds||[]);if(input.checked)values.add(input.dataset.rankingGame);else values.delete(input.dataset.rankingGame);state.blueprint.ranking.excludedGameIds=[...values];markDirty();}));
}

function gameThumb(game) { return escapeHtml((game.title || "?").split(/\s+/).slice(0,2).map((word) => word[0]).join("").toUpperCase()); }
function renderGameList() {
  const query = $("#game-search").value.trim().toLowerCase();
  const root = $("#game-list");
  root.innerHTML = state.blueprint.games.map((game, index) => ({ game, index })).filter(({game}) => !query || `${game.title} ${game.id}`.toLowerCase().includes(query)).map(({game,index}) => `<button class="game-list-item${index === state.selectedGame ? " active" : ""}" type="button" data-game-index="${index}"><span class="brand-mark">${gameThumb(game)}</span><span class="game-list-copy"><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(game.id)}</small></span></button>`).join("");
  $$('[data-game-index]', root).forEach((button) => button.addEventListener("click", () => { state.selectedGame = Number(button.dataset.gameIndex); renderGameList(); renderGameEditor(); }));
}

function gameField(game, key, label, options = {}) {
  const value = game[key] ?? (options.array ? [] : "");
  const wide = options.wide ? " wide" : "";
  let control = options.textarea
    ? `<textarea data-game-key="${key}" rows="${options.rows || 4}">${escapeHtml(value)}</textarea>${options.structured ? `<button class="button secondary small structured-button" type="button" data-structured-game-key="${key}" data-structured-title="${escapeHtml(label)}">Edit sections visually</button>` : ""}`
    : options.boolean
      ? `<input class="switch" data-game-key="${key}" type="checkbox"${value ? " checked" : ""}>`
      : `<input data-game-key="${key}" type="${options.number ? "number" : options.date ? "date" : "text"}" value="${escapeHtml(options.array ? value.join(", ") : value)}"${options.number ? ' min="0"' : ""}>`;
  if (options.resource) control = `<div class="resource-control">${control}<button class="button secondary" type="button" data-resource-game-key="${key}">Browse public images</button></div>${resourcePreviewMarkup(value, `game.${key}`)}`;
  return `<label class="field${wide}"><span>${escapeHtml(label)}</span>${control}${options.hint ? `<small>${escapeHtml(options.hint)}</small>` : ""}</label>`;
}

function replaceGameReference(oldId, newId) {
  if (!oldId || oldId === newId) return;
  if (state.blueprint.site.primaryGameId === oldId) state.blueprint.site.primaryGameId = newId;
  for (const path of ["site.footerGameIds", "home.relatedGameIds", "ranking.excludedGameIds"]) {
    const values = get(path); if (Array.isArray(values)) set(path, values.map((id) => id === oldId ? newId : id));
  }
}

function renderGameEditor() {
  const root = $("#game-editor");
  const game = state.blueprint.games[state.selectedGame];
  if (!game) { root.innerHTML = "<p>No game selected.</p>"; return; }
  const fields = [
    gameField(game,"id","Game ID",{hint:"Changing this updates configured references."}), gameField(game,"title","Game title"),
    gameField(game,"description","Card description",{textarea:true,wide:true}), gameField(game,"metadataDescription","Metadata description",{textarea:true,wide:true}),
    '<h3 class="subheading">Assets & page</h3>', gameField(game,"image","Logo image",{resource:true}), gameField(game,"coverImage","Cover image",{resource:true}), gameField(game,"coverAlt","Cover alt text"), gameField(game,"playUrl","Game URL"),
    '<h3 class="subheading">Background</h3>', gameField(game,"developer","Developer"), gameField(game,"technology","Technology"), gameField(game,"platforms","Platforms",{array:true}), gameField(game,"tags","Display tags",{array:true}),
    gameField(game,"siteAddedAt","Site added date",{date:true}), gameField(game,"createdAt","Original release date",{date:true}), gameField(game,"hot","Hot game",{boolean:true}), gameField(game,"matchBridge","Match bridge",{boolean:true}),
    '<h3 class="subheading">Initial display statistics</h3>', gameField(game,"plays","Plays",{number:true}), gameField(game,"rating","Rating",{number:true}), gameField(game,"ratingCount","Rating votes",{number:true}), gameField(game,"favorites","Favorites",{number:true}), gameField(game,"likes","Likes",{number:true}),
    '<h3 class="subheading">Video & long content</h3>', gameField(game,"youtubeId","YouTube video ID"), gameField(game,"youtubeTitle","YouTube title"), gameField(game,"youtubeDescription","YouTube description",{textarea:true,wide:true}), gameField(game,"detailHtml","Game article HTML",{textarea:true,wide:true,rows:14,structured:true}),
  ];
  const attributes = state.blueprint.filters.groups.map((group) => {
    const selected = group.multiple ? (game[group.attributeKey] || []) : [game[group.attributeKey]].filter(Boolean);
    return `<div class="field wide"><span>${escapeHtml(group.label)}</span><div class="checkbox-grid">${group.options.map((option) => `<label class="check-pill"><input type="${group.multiple ? "checkbox" : "radio"}" name="attribute-${escapeHtml(group.attributeKey)}" data-attribute="${escapeHtml(group.attributeKey)}" data-multiple="${group.multiple}" value="${escapeHtml(option.slug)}"${selected.includes(option.slug) ? " checked" : ""}><span>${escapeHtml(option.label)}</span></label>`).join("")}</div></div>`;
  }).join("");
  root.innerHTML = `<div class="editor-toolbar"><div><h2>${escapeHtml(game.title)}</h2><p>${escapeHtml(game.id)}</p></div><div class="editor-actions"><button class="button secondary" id="duplicate-game" type="button">Duplicate</button><button class="button danger" id="delete-game" type="button"${state.blueprint.games.length === 1 || state.blueprint.site.primaryGameId === game.id ? " disabled" : ""}>Delete</button></div></div><div class="editor-grid">${fields.join("")}<h3 class="subheading">Game attributes</h3>${attributes}</div>`;
  $$('[data-game-key]', root).forEach((input) => input.addEventListener("input", () => {
    const oldId = game.id; let value = input.type === "checkbox" ? input.checked : input.value;
    if (["plays","rating","ratingCount","favorites","likes"].includes(input.dataset.gameKey)) value = Number(value);
    if (["platforms","tags"].includes(input.dataset.gameKey)) value = String(value).split(",").map((item) => item.trim()).filter(Boolean);
    game[input.dataset.gameKey] = value;
    if (input.dataset.gameKey === "id") replaceGameReference(oldId, value);
    if (["image","coverImage"].includes(input.dataset.gameKey)) updateResourcePreview(`game.${input.dataset.gameKey}`, value, root);
    markDirty(); renderGameList();
  }));
  $$('[data-resource-game-key]', root).forEach((button) => button.addEventListener("click", () => openResourceDialog($(`[data-game-key="${CSS.escape(button.dataset.resourceGameKey)}"]`, root))));
  $$('[data-structured-game-key]', root).forEach((button) => button.addEventListener("click", () => {
    const input = $(`[data-game-key="${CSS.escape(button.dataset.structuredGameKey)}"]`, root);
    openStructuredDialog(input.value, button.dataset.structuredTitle, (html) => { input.value = html; input.dispatchEvent(new Event("input", { bubbles:true })); });
  }));
  $$('[data-attribute]', root).forEach((input) => input.addEventListener("change", () => {
    const key = input.dataset.attribute;
    if (input.dataset.multiple === "true") game[key] = $$(`[data-attribute="${CSS.escape(key)}"]:checked`, root).map((item) => item.value);
    else game[key] = input.value;
    markDirty();
  }));
  $("#duplicate-game").addEventListener("click", duplicateGame);
  $("#delete-game").addEventListener("click", deleteGame);
}

function uniqueGameId(base) { let id = base; let number = 2; const ids = new Set(state.blueprint.games.map((game) => game.id)); while (ids.has(id)) id = `${base}-${number++}`; return id; }
function addGame() {
  const id = uniqueGameId("new-game");
  const game = { id, categoryId:state.blueprint.category.id, title:"New Game", description:"Describe this browser game clearly for players in at least forty useful characters.", metadataDescription:"Describe this browser game clearly for search results in at least forty useful characters.", image:`games/${id}/logo.webp`, playUrl:`games/${id}/index.html`, coverImage:`games/${id}/cover.webp`, coverAlt:"New Game background", developer:"Independent Studio", technology:"HTML5", platforms:["Web Browser"], tags:[], plays:0, rating:5, ratingCount:0, favorites:0, likes:0, siteAddedAt:new Date().toISOString().slice(0,10), hot:false, matchBridge:false, detailHtml:"<section><h3>About New Game</h3><p>Add a useful game introduction here.</p></section>" };
  state.blueprint.filters.groups.forEach((group) => { game[group.attributeKey] = group.multiple ? clone(group.generatorDefaultValues || []) : (group.generatorDefaultValues?.[0] || group.defaultValues?.[0]); });
  state.blueprint.games.push(game); state.selectedGame = state.blueprint.games.length - 1; markDirty(); renderGameList(); renderGameEditor();
}
function duplicateGame() { const source = state.blueprint.games[state.selectedGame]; const copy = clone(source); copy.id = uniqueGameId(`${source.id}-copy`); copy.title = `${source.title} Copy`; copy.siteAddedAt = new Date().toISOString().slice(0,10); state.blueprint.games.push(copy); state.selectedGame = state.blueprint.games.length - 1; markDirty(); renderGameList(); renderGameEditor(); }
function deleteGame() { const game = state.blueprint.games[state.selectedGame]; if (!game || game.id === state.blueprint.site.primaryGameId || !confirm(`Delete ${game.title}?`)) return; state.blueprint.games.splice(state.selectedGame,1); for (const path of ["site.footerGameIds","home.relatedGameIds","ranking.excludedGameIds"]) { const values=get(path); if(Array.isArray(values)) set(path,values.filter((id)=>id!==game.id)); } state.selectedGame=Math.max(0,state.selectedGame-1); markDirty(); renderGameList(); renderGameEditor(); }

function renderFilters() {
  const settings=$("#filter-settings");
  settings.innerHTML=`<label class="field"><span>Primary Similar Games group</span><select id="primary-match-group">${state.blueprint.filters.groups.map((group)=>`<option value="${escapeHtml(group.key)}"${state.blueprint.filters.primaryMatchGroup===group.key?" selected":""}>${escapeHtml(group.label)}</option>`).join("")}</select></label><label class="field"><span>URL aliases</span><textarea id="filter-aliases" rows="4" placeholder="mobile = touch">${escapeHtml(Object.entries(state.blueprint.filters.aliases||{}).map(([alias,target])=>`${alias} = ${target}`).join("\n"))}</textarea><small>One alias per line: old-name = current-option</small></label>`;
  $("#primary-match-group").addEventListener("change",(event)=>{state.blueprint.filters.primaryMatchGroup=event.target.value;markDirty();});
  $("#filter-aliases").addEventListener("input",(event)=>{const aliases={};event.target.value.split(/\r?\n/).forEach((line)=>{const [alias,target]=line.split("=").map((value)=>value?.trim());if(alias&&target)aliases[alias]=target;});state.blueprint.filters.aliases=aliases;markDirty();});
  const root = $("#filter-editor");
  root.innerHTML = state.blueprint.filters.groups.map((group,index) => `<article class="card filter-card" data-filter-index="${index}"><div class="filter-head"><div><h2>${escapeHtml(group.label)}</h2><p>${escapeHtml(group.attributeKey)} · ${group.options.length} options</p></div><button class="button danger small" type="button" data-delete-filter="${index}"${state.blueprint.filters.groups.length === 1 ? " disabled" : ""}>Delete group</button></div><div class="filter-fields">${["key","attributeKey","generatorKey","label","icon"].map((key)=>`<label class="field"><span>${titleCase(key)}</span><input data-filter-key="${key}" value="${escapeHtml(group[key])}"></label>`).join("")}<label class="toggle"><span>Multiple values</span><input class="switch" data-filter-multiple type="checkbox"${group.multiple ? " checked" : ""}></label><label class="field"><span>Default values</span><input data-filter-array="defaultValues" value="${escapeHtml((group.defaultValues||[]).join(", "))}"></label><label class="field"><span>Generator defaults</span><input data-filter-array="generatorDefaultValues" value="${escapeHtml((group.generatorDefaultValues||[]).join(", "))}"></label></div><div class="option-list">${group.options.map((option,optionIndex)=>`<div class="option-row"><input data-option-key="slug" data-option-index="${optionIndex}" value="${escapeHtml(option.slug)}" aria-label="Option slug"><input data-option-key="label" data-option-index="${optionIndex}" value="${escapeHtml(option.label)}" aria-label="Option label"><textarea data-option-key="description" data-option-index="${optionIndex}" aria-label="Option description">${escapeHtml(option.description)}</textarea><button class="button danger small" type="button" data-delete-option="${optionIndex}"${group.options.length === 1 ? " disabled" : ""}>Remove</button></div>`).join("")}</div><button class="button secondary small add-option" type="button" data-add-option>Add option</button></article>`).join("");
  $$('.filter-card',root).forEach((card)=>bindFilterCard(card,Number(card.dataset.filterIndex)));
}

function bindFilterCard(card,index) {
  const group=state.blueprint.filters.groups[index];
  $$('[data-filter-key]',card).forEach((input)=>input.addEventListener("input",()=>{const key=input.dataset.filterKey;const old=group[key];group[key]=input.value;if(key==="attributeKey"&&old!==input.value){state.blueprint.games.forEach((game)=>{game[input.value]=game[old];delete game[old];});}if(key==="key"&&state.blueprint.filters.primaryMatchGroup===old)state.blueprint.filters.primaryMatchGroup=input.value;markDirty();}));
  $('[data-filter-multiple]',card).addEventListener("change",(event)=>{group.multiple=event.target.checked;markDirty();});
  $$('[data-filter-array]',card).forEach((input)=>input.addEventListener("input",()=>{group[input.dataset.filterArray]=input.value.split(",").map((item)=>item.trim()).filter(Boolean);markDirty();}));
  $$('[data-option-key]',card).forEach((input)=>input.addEventListener("input",()=>{group.options[Number(input.dataset.optionIndex)][input.dataset.optionKey]=input.value;markDirty();}));
  $$('[data-delete-option]',card).forEach((button)=>button.addEventListener("click",()=>{const option=group.options[Number(button.dataset.deleteOption)];if(!confirm(`Remove ${option.label}?`))return;group.options.splice(Number(button.dataset.deleteOption),1);group.defaultValues=(group.defaultValues||[]).filter((value)=>value!==option.slug);group.generatorDefaultValues=(group.generatorDefaultValues||[]).filter((value)=>value!==option.slug);state.blueprint.games.forEach((game)=>{if(Array.isArray(game[group.attributeKey]))game[group.attributeKey]=game[group.attributeKey].filter((value)=>value!==option.slug);else if(game[group.attributeKey]===option.slug)game[group.attributeKey]=group.options[0]?.slug;});markDirty();renderFilters();renderGameEditor();}));
  $('[data-add-option]',card).addEventListener("click",()=>{let number=group.options.length+1;let slug=`option-${number}`;while(group.options.some((option)=>option.slug===slug))slug=`option-${++number}`;group.options.push({slug,label:`Option ${number}`,description:"Describe which games belong to this option."});markDirty();renderFilters();});
  $('[data-delete-filter]',card).addEventListener("click",()=>{if(!confirm(`Delete the ${group.label} group?`))return;state.blueprint.filters.groups.splice(index,1);state.blueprint.games.forEach((game)=>delete game[group.attributeKey]);if(state.blueprint.filters.primaryMatchGroup===group.key)state.blueprint.filters.primaryMatchGroup=state.blueprint.filters.groups[0].key;markDirty();renderFilters();renderGameEditor();});
}

function addFilter() { let number=state.blueprint.filters.groups.length+1;let key=`group-${number}`;while(state.blueprint.filters.groups.some((group)=>group.key===key))key=`group-${++number}`;state.blueprint.filters.groups.push({key,attributeKey:`attribute${number}`,generatorKey:key,label:`Group ${number}`,icon:"filters",multiple:true,defaultValues:[],generatorDefaultValues:["option-1"],options:[{slug:"option-1",label:"Option 1",description:"Describe which games belong to this option."}]});state.blueprint.games.forEach((game)=>game[`attribute${number}`]=["option-1"]);markDirty();renderFilters();renderGameEditor();}

function syncJsonEditor() { if (state.blueprint) $("#json-editor").value = JSON.stringify(state.blueprint,null,2); }
function bindJsonEditor() { $("#json-editor").addEventListener("input",()=>{try{state.blueprint=JSON.parse($("#json-editor").value);state.jsonValid=true;markDirty();$("#json-editor").setCustomValidity("");}catch(error){state.jsonValid=false;$("#json-editor").setCustomValidity(error.message);$("#save-state").textContent="Invalid JSON";$("#save-state").className="state-pill dirty";$("#save-button").disabled=true;}});$("#format-json-button").addEventListener("click",()=>{try{state.blueprint=JSON.parse($("#json-editor").value);syncJsonEditor();state.jsonValid=true;markDirty();}catch(error){notice(error.message,"error");}});}

function renderVisualSections() { renderSite();renderRoutes();renderTheme();renderPages();renderGameList();renderGameEditor();renderFilters();renderLegal();renderDeployment(); }
function switchSection(name) { const leavingAdvanced=$("#section-advanced").classList.contains("active")&&name!=="advanced";if(leavingAdvanced&&state.jsonValid)renderVisualSections();$$('.nav-item').forEach((button)=>button.classList.toggle("active",button.dataset.section===name));$$('.page-section').forEach((section)=>section.classList.toggle("active",section.id===`section-${name}`));$("#page-title").textContent=sectionCopy[name][0];$("#page-description").textContent=sectionCopy[name][1];if(name==="advanced")syncJsonEditor(); }

function renderPreview(summary) {
  const changes=summary.changes.length?`<div class="change-list">${summary.changes.map((file)=>`<code>${escapeHtml(file)}</code>`).join("")}</div>`:"<p>No generated files would change.</p>";
  const missing=summary.missingResources.length?`<div class="warning-list"><strong>${summary.missingResources.length} local resources are missing.</strong>${summary.missingResources.slice(0,8).map((item)=>`<div>${escapeHtml(item.value)} · ${escapeHtml(item.owner)}</div>`).join("")}</div>`:'<p class="notice">All referenced local resources are present.</p>';
  $("#preview-summary").innerHTML=`<p><strong>${summary.siteName}</strong> · ${summary.games} games · ${summary.filters} filter groups</p>${changes}${missing}`;
  $("#confirm-site-id").value="";$("#confirm-save-button").disabled=summary.missingResources.length>0||summary.changes.length===0;$("#preview-dialog").showModal();setTimeout(()=>$("#confirm-site-id").focus(),50);
}

async function preview() { if(!state.jsonValid)return notice("Fix the JSON before previewing.","error");setBusy(true,"Checking…");try{const summary=await api("/api/preview",{method:"POST",body:JSON.stringify({blueprint:state.blueprint,baseRevision:state.revision})});if(summary.diskChanged)throw new Error("The blueprint changed on disk. Reload before continuing.");state.preview=summary;renderPreview(summary);}catch(error){notice(error.message,"error");}finally{setBusy(false);} }
async function applyChanges() { if(!state.preview)return;const confirmValue=$("#confirm-site-id").value.trim();if(confirmValue!==state.preview.siteId)return notice(`Type ${state.preview.siteId} to confirm.`,"error");$("#confirm-save-button").disabled=true;$("#confirm-save-button").textContent="Validating…";try{const result=await api("/api/apply",{method:"POST",body:JSON.stringify({blueprint:state.blueprint,baseRevision:state.revision,previewDigest:state.preview.previewDigest,confirm:confirmValue})});$("#preview-dialog").close();await loadBlueprint();notice(`Saved and generated ${result.changes.length} file${result.changes.length===1?"":"s"}. Backup: ${result.backup||"not required"}`);}catch(error){notice(error.message,"error");}finally{$("#confirm-save-button").textContent="Save, validate & generate";$("#confirm-save-button").disabled=false;} }
function setBusy(busy,label="") { $("#preview-button").disabled=busy;$("#reload-button").disabled=busy;$("#save-button").disabled=busy||!state.dirty||!state.jsonValid;if(label)$("#save-state").textContent=label;else if(state.dirty)markDirty();else markSaved(); }

function ensureAdminDefaults() {
  if (state.blueprint.legal) return;
  const name=state.blueprint.site.brandName;
  state.blueprint.legal={pages:{aboutUs:{path:"/about-us",navLabel:"About Us",eyebrow:"Who we are",title:`About ${name}`,metadataTitle:"About Us",description:"A player-focused browser gaming site.",seoDescription:`Learn about ${name}.`},contactUs:{path:"/contact-us",navLabel:"Contact Us",eyebrow:"Get in touch",title:"Contact Us",metadataTitle:"Contact Us",description:"Contact us about site issues, feedback, privacy, or copyright.",seoDescription:`Contact ${name}.`},dmca:{path:"/dmca",navLabel:"DMCA",eyebrow:"Copyright",title:"DMCA and Copyright Policy",metadataTitle:"DMCA and Copyright Policy",description:"We respect intellectual property rights.",seoDescription:`Read the copyright policy for ${name}.`,showLastUpdated:true},terms:{path:"/terms-of-service",navLabel:"Terms of Service",eyebrow:"Legal",title:"Terms of Service",metadataTitle:"Terms of Service",description:`Terms governing access to ${name}.`,seoDescription:`Read the terms for ${name}.`,showLastUpdated:true},privacy:{path:"/privacy-policy",navLabel:"Privacy Policy",eyebrow:"Privacy",title:"Privacy Policy",metadataTitle:"Privacy Policy",description:`How ${name} processes information.`,seoDescription:`Read the privacy policy for ${name}.`,showLastUpdated:true}},aboutUs:{whyBuilt:{title:"Why We Built This Site",paragraphs:["Explain why this site exists and how it helps players."]},catalog:{title:"What You Can Find Here",paragraphs:["Describe the games and discovery experience available here."]},profiles:{title:"Player Profiles and Community Activity",paragraphs:["Explain profiles, local progress, and community activity."],privacyLinkLabel:"Privacy Policy"},independence:{title:"Independent Website",paragraphs:[`${name} is an independent website.`]},contact:{title:"Contact",lead:"For support or rights concerns, visit our",linkLabel:"Contact Us",suffix:"page or email"}}};
}

async function loadBlueprint() { setBusy(true,"Loading…");try{const [payload,resources]=await Promise.all([api("/api/blueprint"),api("/api/resources")]);state.blueprint=payload.blueprint;state.resources=resources.images||[];state.competitionAdapters=payload.competitionAdapters||[];ensureAdminDefaults();state.revision=payload.revision;state.selectedGame=Math.min(state.selectedGame,state.blueprint.games.length-1);state.jsonValid=true;state.preview=null;renderVisualSections();syncJsonEditor();markSaved();document.title=`${state.blueprint.site.name} · Site Studio`;}catch(error){notice(error.message,"error");$("#save-state").textContent="Connection failed";}finally{setBusy(false);}}

function bindGlobalEvents() {
  $$('.nav-item').forEach((button)=>button.addEventListener("click",()=>switchSection(button.dataset.section)));
  $("#reload-button").addEventListener("click",()=>{if(state.dirty&&!confirm("Discard unsaved changes and reload?"))return;loadBlueprint();});
  $("#preview-button").addEventListener("click",preview);$("#save-button").addEventListener("click",preview);$("#confirm-save-button").addEventListener("click",applyChanges);
  $("#add-faq-button").addEventListener("click",addFaq);$("#add-game-button").addEventListener("click",addGame);$("#add-filter-button").addEventListener("click",addFilter);$("#game-search").addEventListener("input",renderGameList);bindJsonEditor();
  $("#resource-search").addEventListener("input",renderResourceGallery);
  $("#add-structured-section").addEventListener("click",()=>{syncStructuredSections();state.structuredSections.push({raw:false,className:"",attributes:[],headingTag:"h3",headingAttributes:[],headingHtml:"New section",bodyHtml:"<p>Add useful content here.</p>"});renderStructuredSections();});
  $("#apply-structured-sections").addEventListener("click",applyStructuredSections);
  $$('[data-close-dialog]').forEach((button)=>button.addEventListener("click",()=>$("#"+button.dataset.closeDialog).close()));
  $("#resource-dialog").addEventListener("close",()=>{state.resourceTarget=null;});
  window.addEventListener("beforeunload",(event)=>{if(!state.dirty)return;event.preventDefault();event.returnValue="";});
}

state.token=readToken();bindGlobalEvents();
if(!state.token)notice("This local studio link is missing its temporary access token. Restart npm run site:admin.","error");else loadBlueprint();
