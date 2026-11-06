# Run from the repository root: Rscript tests/method_cases.R
# Export the browser inputs and results, then compare against base R fits.
js <- "
import { anovaCase, blockCase, factorialCase, factorialSSCase, regressionCase, unbalancedCase } from './assets/method-cases.mjs';
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
  const f = factorialCase(i);
  row('f', f.cells.flat(), [f.sse,f.mse,f.df], ...f.contrasts.map(c => [c.estimate,c.se,c.t,c.f,c.p]));
}
for (let a=1; a<=9; a++) for (let b=1; b<=9; b++) {
  const u = unbalancedCase([a,b]);
  row('u',u.centers.flat(),u.counts.flat(),[...u.raw,...u.adjusted,u.rawDifference,u.adjustedDifference]);
}
for (const type of [0,1,2]) for (const order of [0,1]) {
  const s = factorialSSCase(type,order);
  row('s',type,order,s.cells.map(g=>g.length),s.cells.flat(),
    [s.sse.null,s.sse.A,s.sse.B,s.sse.add,s.sse.full,s.mse,s.df],
    ...s.terms.map(t=>[t.ss,t.df,t.f,t.p]));
}"
rows <- system2("node", c("--input-type=module", "-e", shQuote(js)), stdout=TRUE)
stopifnot(length(rows) == 97)
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
  } else if (f[1] == "f") {
    d <- data.frame(height=parse(f[2]),
                    variety=factor(rep(1:2,each=6)), dose=factor(rep(rep(1:2,each=3),2)))
    fit <- lm(height ~ 0 + interaction(dose,variety), data=d)
    tab <- anova(lm(height ~ variety * dose, data=d))
    same(parse(f[3]), c(deviance(fit),sigma(fit)^2,df.residual(fit)))
    weights <- rbind(c(-.5,-.5,.5,.5), c(1,-1,-1,1), c(0,-1,0,1))
    estimates <- drop(weights %*% coef(fit))
    se <- sqrt(diag(weights %*% vcov(fit) %*% t(weights)))
    t <- estimates/se
    p <- 2*pt(-abs(t),df.residual(fit))
    for (i in seq_along(t)) {
      same(parse(f[i+3]), c(estimates[i],se[i],t[i],t[i]^2,p[i]))
    }
    same(t[1:2]^2, tab[c(1,3),"F value"])
  } else if (f[1] == "u") {
    centers <- parse(f[2])
    counts <- parse(f[3])
    grid <- data.frame(variety=factor(rep(1:2,each=2)), dose=factor(rep(1:2,2)))
    d <- grid[rep(seq_len(nrow(grid)),counts),]
    d$height <- unlist(Map(function(m,n) m + if (n==1) 0 else seq(-1,1,length.out=n),
                           centers,counts))
    raw <- tapply(d$height,d$variety,mean)
    fit <- lm(height ~ variety * dose, data=d)
    adjusted <- tapply(predict(fit, newdata=grid),grid$variety,mean)
    same(parse(f[4]), c(raw,adjusted,diff(raw),diff(adjusted)))
  } else if (f[1] == "s") {
    type <- as.integer(f[2])
    rev <- as.integer(f[3]) == 1
    n <- parse(f[4])
    d <- data.frame(A=factor(rep(rep(1:3,each=2),n)),
                    B=factor(rep(rep(1:2,3),n)), y=parse(f[5]))
    full <- lm(if (rev) y ~ B*A else y ~ A*B, data=d,
               contrasts=list(A=contr.sum,B=contr.sum))
    models <- list(lm(y~1,d),lm(y~A,d),lm(y~B,d),lm(y~A+B,d),full)
    edf <- df.residual(full)
    mse <- deviance(full)/edf
    residual_ss <- vapply(models,deviance,numeric(1))
    same(parse(f[6]), c(residual_ss,mse,edf))
    term_names <- c("A","B",if (rev) "B:A" else "A:B")
    df <- c(2,1,2)
    if (type == 0L) {
      ref <- anova(full)[term_names,]
      for (i in seq_along(term_names)) {
        same(parse(f[i+6]), unlist(ref[i,c("Sum Sq","Df","F value","Pr(>F)")],use.names=FALSE))
      }
    } else {
      if (type == 1L) {
        ss <- c(anova(models[[3]],models[[4]])[2,"Sum of Sq"],
                anova(models[[2]],models[[4]])[2,"Sum of Sq"],
                anova(models[[4]],full)[2,"Sum of Sq"])
      } else {
        X <- model.matrix(full)
        index <- match(term_names,attr(terms(full),"term.labels"))
        ss <- vapply(index,function(i) {
          restricted <- lm.fit(X[,attr(X,"assign")!=i,drop=FALSE],d$y)
          sum(restricted$residuals^2)-deviance(full)
        },numeric(1))
      }
      Fval <- ss/df/mse
      p <- pf(Fval,df,edf,lower.tail=FALSE)
      for (i in seq_along(term_names)) same(parse(f[i+6]),c(ss[i],df[i],Fval[i],p[i]))
      if (requireNamespace("car",quietly=TRUE)) {
        car <- car::Anova(full,type=type+1L)[term_names,]
        same(car[["Sum Sq"]],ss)
        same(car[["F value"]],Fval)
        same(car[["Pr(>F)"]],p)
      }
    }
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
cat("Method cases, all 81 unbalanced allocations and all six Type I/II/III orders agree with base R.\n")
