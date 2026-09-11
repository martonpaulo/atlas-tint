/** Explicit contextual land from the pinned Natural Earth source; never part of primary progress. */
const rows = `
mp|MP|Northern Mariana Islands|MP
vi|VI|United States Virgin Islands|VI
gu|GU|Guam|GU
as|AS|American Samoa|AS
pr|PR|Puerto Rico|PR
gs|GS|South Georgia and the Islands|GS
io|IO|British Indian Ocean Territory|IO
sh|SH|Saint Helena|SH
pn|PN|Pitcairn Islands|PN
ai|AI|Anguilla|AI
fk|FK|Falkland Islands|FK
ky|KY|Cayman Islands|KY
bm|BM|Bermuda|BM
vg|VG|British Virgin Islands|VG
tc|TC|Turks and Caicos Islands|TC
ms|MS|Montserrat|MS
je|JE|Jersey|JE
gg|GG|Guernsey|GG
im|IM|Isle of Man|IM
tw|TW|Taiwan|TW
somaliland|NE-SOL|Somaliland|
nu|NU|Niue|NU
ck|CK|Cook Islands|CK
aw|AW|Aruba|AW
cw|CW|Curaçao|CW
eh|EH|Western Sahara|EH
xk|XK|Kosovo|XK
pm|PM|Saint Pierre and Miquelon|PM
wf|WF|Wallis and Futuna|WF
mf|MF|Saint Martin|MF
bl|BL|Saint Barthelemy|BL
pf|PF|French Polynesia|PF
nc|NC|New Caledonia|NC
tf|TF|French Southern and Antarctic Lands|TF
ax|AX|Aland|AX
gl|GL|Greenland|GL
fo|FO|Faroe Islands|FO
northern-cyprus|NE-CYN|Northern Cyprus|
mo|MO|Macao S.A.R|MO
hk|HK|Hong Kong S.A.R.|HK
hm|HM|Heard Island and McDonald Islands|HM
nf|NF|Norfolk Island|NF
siachen-glacier|NE-KAS|Siachen Glacier|
aq|AQ|Antarctica|AQ
sx|SX|Sint Maarten|SX
`
	.trim()
	.split("\n");

export const worldContextEntities = rows.map((row) => {
	const [slug, geometryId, name, code] = row.split("|");
	return {
		id: `world-${slug}`,
		geometryId,
		name,
		localNames: [],
		aliases: [],
		codes: code ? [code] : [],
		groupId: "world-context",
		groupName: "Geographic context",
		groupAliases: ["Territories", "Non-primary regions"],
		selectable: false,
	};
});
