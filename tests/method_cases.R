# Run from the repository root: Rscript tests/method_cases.R
# Export the browser inputs and results, then compare against base R fits.
js <- "
import { anovaCase, blockCase, regressionCase } from './assets/method-cases.mjs';
const row = (...x) => console.log(x.map(a => Array.isArray(a) ? a.map(v => v ?? 'NA').join(',') : a).join('|'));
for (const i of [0,1]) {
  const a = anovaCase(i);
  row('a', ...a.groups, [a.ordinary.f,a.ordinary.dfe,a.ordinary.p,a.welch.f,a.welch.df2,a.welch.p]);
  const b = blockCase(i);
  row('b', b.a, b.b, [b.raw,b.estimate,b.se,b.df,b.t,b.p,b.lo,b.hi]);
}
for (const i of [0,1,2]) {
  const r = regressionCase(i);
  row('r',r.x,r.y,[r.fit.slope,r.slopeP,r.fit.sse,r.ssPE,r.ssLOF,r.dfPE,r.dfLOF,r.lofF,r.lofP]);
}"
rows <- system2("node", c("--input-type=module", "-e", shQuote(js)), stdout=TRUE)
stopifnot(length(rows) == 7)
parse <- function(s) {
  fields <- strsplit(s, ",", fixed=TRUE)[[1]]
  fields[fields == "NA"] <- NA_character_
  as.numeric(fields)
}
same <- function(observed, expected) {
  stopifnot(isTRUE(all.equal(unname(observed), unname(expected), tolerance=1e-9)))
}
for (row in rows) {
  f <- strsplit(row, "|", fixed=TRUE)[[1]]
  if (f[1] == "a") {
    tall <- stack(setNames(lapply(f[2:4], parse), c("A","B","C")))
    common <- oneway.test(values ~ ind, tall, var.equal=TRUE)
    welch <- oneway.test(values ~ ind, tall)
    same(parse(f[5]), c(common$statistic, common$parameter[2], common$p.value,
                        welch$statistic, welch$parameter[2], welch$p.value))
  } else if (f[1] == "b") {
    a <- parse(f[2])
    b <- parse(f[3])
    d <- data.frame(height=c(a,b), block=factor(rep(seq_along(a),2)),
                    treatment=factor(rep(c("A","B"),each=length(a))))
    adjusted <- coef(summary(lm(height ~ block + treatment, data=d)))["treatmentB",]
    paired <- t.test(b,a,paired=TRUE)
    same(parse(f[4]), c(mean(b,na.rm=TRUE)-mean(a),adjusted[1:2],paired$parameter,
                        adjusted[3:4],paired$conf.int))
  } else {
    d <- data.frame(x=parse(f[2]),y=parse(f[3]))
    straight <- lm(y ~ x, data=d)
    saturated <- lm(y ~ factor(x), data=d)
    compare <- anova(straight, saturated)
    expect <- c(coef(straight)[2],anova(straight)[["Pr(>F)"]][1],
                deviance(straight),deviance(saturated),compare[["Sum of Sq"]][2],
                df.residual(saturated),compare$Df[2],compare$F[2],compare[["Pr(>F)"]][2])
    same(parse(f[4]), expect)
  }
}
cat("Seven ANOVA, block and regression scenarios agree with base R.\n")
