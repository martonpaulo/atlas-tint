/**
 * The upstream archives the generated geographic artifacts are built from.
 *
 * Shared by the build, which downloads and verifies them, and by the check, which asserts that
 * the committed metadata records these exact sources and no others.
 */
export const sources = {
	world: {
		filename: "world.zip",
		url: "https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip",
		sha256: "5fed433373581fa648920435f937d95f2d3c0200e067409c6478dcdf1b853139",
		version: "Natural Earth Admin 0 Countries 5.1.1, 1:50m",
		license: "Natural Earth public domain",
	},
	brazil: {
		filename: "brazil.zip",
		url: "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2024/Brasil/BR_UF_2024.zip",
		sha256: "be61a1e11bf86b265098b5a0b02eb836237421ad73354b1f0892fb6be4598866",
		version: "IBGE Malha Municipal Digital 2024 — Unidades da Federação",
		license: "Public IBGE geographic data; attribution required",
	},
	spain: {
		filename: "spain.zip",
		url: "https://centrodedescargas.cnig.es/CentroDescargas/descargaDir",
		requestBody: "secDescDirLA=9000029&secuencial=9000029",
		sha256: "d752b1b943e6c60f46a23119d6c3d4ad0b198461c502f0a5433197d7a5e34c83",
		version: "IGN/CNIG BDDAE provincial enclosures, published 2026-07-28",
		license: "Derived work of BDLJE CC-BY 4.0 ign.es",
	},
};
