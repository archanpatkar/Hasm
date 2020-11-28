#!/usr/bin/env node

const { strict } = require("assert");
// Write the HACK assembler
const fs = require("fs");
const predefined = JSON.parse(fs.readFileSync(`${__dirname}/predsym.json`));
const translation = JSON.parse(fs.readFileSync(`${__dirname}/translations.json`));

function itoB(n,bits) {
    let tmp = parseInt(n);
    let bn = "";
    for(let i = 0;i < bits;i++) {
        bn = (tmp % 2) + bn;
        tmp = Math.floor(tmp/2);
    }
    return bn;
}

const white = [" ", "\n", "\b", "\t", "\r"];
function isWhite(c) {
    return white.includes(c);
}

const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
function isNumber(c) {
    return digits.includes(c);
}

const A = "a";
const C = "c";
const L = "l";
const createCommand = (type,...values) => {
    if(type == A) return { type:A, value:values[0] };
    else if(type == C) return { type:C, comp:values[0], dest:values[1], jmp:values[2] };
    return { type:L, label:values[0] };
};

class Parser {
    constructor(code) {
        this.setup(code);
    }

    setup(code) {
        this.code = code;
        this.removeWhitespace();
        this.removeComments();
        this.parsed = [];
    }

    removeWhitespace() {
        this.code = this.code.trim().split("\n")
                    .map(
                        line => line.split("")
                                .filter(l => !isWhite(l))
                                .join("")
                    )
                    .filter(l => !l.length == 0);
    }

    removeComments() {
        this.code = this.code.filter(line => !line.startsWith("//"))
                    .map(line => line.split("//")[0]);
    }

    add(v) {
        this.parsed.push(v);
    }

    handleA() {
        this.add(createCommand(A,this.curr.split("@")[1]));
    }

    handleC() {
        let [exp, jmp] = this.curr.split(";");
        let [dest, comp] = exp.split("=");
        if(!comp || comp.length == 0) {
            comp = dest;
            dest = undefined;
        }
        this.add(createCommand(C,comp,dest,jmp));
    }

    handleL() {
        this.add(createCommand(L,this.curr.slice(1,this.curr.length-1)));
    }

    parse(code) {
        if(code) this.setup(code);
        for(let line of this.code) {
            this.curr = line;
            if(line.startsWith("@")) this.handleA();
            else if(line.startsWith("(")) this.handleL();
            else this.handleC();
        }
        return this.parsed;
    }
}


class Assembler {
    constructor(code) {
        this.setup(code);
    }

    setup(code,initials=predefined) {
        this.parser = new Parser(code);
        this.code = this.parser.parse();
        this.sym = Object.assign({}, initials);
        this.compiled = [];
        this.varStart = 16;
    }

    handleLabels() {
        let rm = 0;
        this.code = this.code.filter((command,i) => { 
            if(command.type == L) {
                if(!(command.label in this.sym)) this.sym[command.label]=i-(rm++);
                else throw new Error("Label already exists");    
                return false;
            }
            return true;
        });
    }

    handleVariables() {
        this.code.forEach(command => {
            if(command.type == A) {
                if(isNumber(command.value[0])) 
                    command.value = parseInt(command.value)
                else if(!(command.value in this.sym)) 
                    this.sym[command.value] = this.varStart++; 
            }
        });
    }

    translate() {
        this.compiled = this.code.map(command => {
            if(command.type == A) 
                return "0"+itoB(
                    typeof command.value == "string"? 
                    this.sym[command.value]:
                    command.value,
                15);
            else if(command.type == C) {
                let comp = translation.comp[command.comp];
                let dest = translation.dest[command.dest];
                let jump = translation.jump[command.jmp];
                return `111${comp}${dest}${jump}`;
            } 
            throw new Error("Unidentified Command");
        });
    }

    assemble(code) {
        if(code) this.setup(code);
        this.handleLabels();
        this.handleVariables();
        this.translate();
        return this.compiled;
    }
}

function main(args) {
    console.log("Reading...");
    const code = fs.readFileSync(args[0]).toString();
    const asmb = new Assembler(code);
    console.log("Assembling...");
    const compiled = asmb.assemble();
    fs.writeFileSync(`${args[0].split(".")[0]}.hack`, compiled.join("\n"));
    console.log("Compiled to Machine Language.");
}

const args = process.argv.slice(2);
main(args);
